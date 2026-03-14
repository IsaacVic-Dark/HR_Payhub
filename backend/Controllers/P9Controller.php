<?php
// app/Controllers/P9Controller.php

namespace App\Controllers;

use App\Services\DB;
use App\Middleware\AuthMiddleware;

/**
 * P9Controller
 *
 * Generates and manages P9 Annual Tax Deduction Cards for KRA filing.
 *
 * ── p9forms table (updated.sql) ──────────────────────────────────────────────
 *  id                 INT  AUTO_INCREMENT PK
 *  organizationid     INT  NOT NULL  → FK organizations(id)
 *  employeeid         INT  NOT NULL  → FK employees(id)
 *  year               INT  NOT NULL
 *  p9number           VARCHAR(50) NOT NULL      e.g. "P9-2024-EMP001"
 *  employee_pin       VARCHAR(11)               from employee_profiles.kra_pin
 *  total_basic_salary DECIMAL(15,2)             annual sum of basic_salary
 *  total_gross_pay    DECIMAL(15,2)             annual sum of gross_pay
 *  total_taxable_pay  DECIMAL(15,2)             annual sum of taxable_income
 *  total_paye         DECIMAL(15,2)             annual net PAYE after all reliefs
 *  monthly_data       JSON                      12-month breakdown array
 *  pdfpath            VARCHAR(500)              server path to generated PDF
 *  status             ENUM('generated','sent','filed')  DEFAULT 'generated'
 *  generatedat        TIMESTAMP                 DEFAULT CURRENT_TIMESTAMP
 *  UNIQUE KEY unique_p9 (organizationid, employeeid, year)
 *
 * ── monthly_data JSON structure (12 objects, one per calendar month) ─────────
 *  {
 *    "month": 1,  "month_name": "January",  "year": 2024,
 *    "payrun_id": 14,  "payrun_detail_id": 87,
 *    "basic_salary": 50000.00,
 *    "overtime_amount": 0.00,  "bonus_amount": 0.00,  "commission_amount": 0.00,
 *    "gross_pay": 55000.00,
 *    "nssf": 1080.00,  "shif": 1512.50,  "housing_levy": 825.00,
 *    "taxable_pay": 52082.50,
 *    "tax_before_relief": 12624.98,
 *    "personal_relief": 2400.00,  "insurance_relief": 0.00,
 *    "paye": 10224.98,
 *    "net_pay": 41233.02
 *  }
 *
 * ── Supporting tables used ───────────────────────────────────────────────────
 *  employees          id, organization_id, user_id, employee_number,
 *                     department_id, reports_to, base_salary, status
 *  users              id, first_name, surname, user_type
 *  employee_profiles  employee_id, kra_pin, nssf_number, shif_number,
 *                     paye_exemption_type, paye_exemption_amount
 *  organizations      id, name, kra_pin, nssf_number
 *  departments        id, name
 *  payruns            id, organization_id, pay_period_start, pay_period_end,
 *                     status (draft|reviewed|finalized), deleted_at
 *  payrun_details     id, payrun_id, organization_id, employee_id,
 *                     basic_salary, overtime_amount, bonus_amount,
 *                     commission_amount, gross_pay,
 *                     nssf, shif, housing_levy,
 *                     taxable_income, tax_before_relief,
 *                     personal_relief, paye, total_deductions, net_pay
 *  payrun_deductions  payrun_detail_id, config_id, amount
 *  organization_configs  id, config_type, name, is_active
 *
 * ── Kenya statutory rates (Finance Act 2023 / 2024) ─────────────────────────
 *  PAYE bands (monthly taxable pay):
 *    0 – 24,000         →  10%
 *    24,001 – 32,333    →  25%
 *    32,334 – 500,000   →  30%
 *    500,001 – 800,000  →  32.5%
 *    800,001+           →  35%
 *  Personal relief     KES 2,400 / month
 *  Insurance relief    15% of premiums paid, max KES 5,000 / month
 *  NSSF (Act 2013):
 *    Tier I  = 6% × LEL (6,000) = KES 360 employee
 *    Tier II = 6% × (min(gross,18,000) − 6,000), max KES 720 employee
 *  SHIF (replaces NHIF Oct 2024): 2.75% of gross, min KES 300
 *  AHL: 1.5% of gross (stored as payrun_details.housing_levy), tax-deductible
 *
 * NOTE: payrun_details already stores pre-computed statutory values.
 * The controller reads those stored values first and only falls back to
 * re-computation when a value is zero, covering legacy records.
 */
class P9Controller
{
    // ── Statutory constants ──────────────────────────────────────────────────

    private const PERSONAL_RELIEF_MONTHLY = 2400;
    private const INSURANCE_RELIEF_RATE   = 0.15;
    private const INSURANCE_RELIEF_CAP    = 5000;
    private const SHIF_RATE               = 0.0275;
    private const SHIF_MINIMUM            = 300;
    private const NSSF_LEL                = 6000;
    private const NSSF_UEL                = 18000;
    private const NSSF_RATE               = 0.06;
    private const AHL_EMPLOYEE_RATE       = 0.015;

    /** [upper_limit_inclusive, rate] — last band uses PHP_INT_MAX */
    private const PAYE_BANDS = [
        [24000,       0.10],
        [32333,       0.25],
        [500000,      0.30],
        [800000,      0.325],
        [PHP_INT_MAX, 0.35],
    ];

    // =========================================================================
    // PUBLIC ENDPOINTS
    // =========================================================================

    /**
     * GET /api/v1/organizations/{org_id}/p9-forms
     *
     * Paginated list of P9 forms for an organisation.
     * Query params: year, employee_id, department_id, status, page, per_page
     *
     * Role scoping: employees see only their own records.
     */
    public function index($org_id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }
            if (!$this->orgExists((int)$org_id)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Organization not found',
                    code: 404
                );
            }

            // ── Pagination ───────────────────────────────────────────────────
            $page    = max(1, (int)($_GET['page']    ?? 1));
            $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 15)));
            $offset  = ($page - 1) * $perPage;

            // ── Filters ──────────────────────────────────────────────────────
            $year         = isset($_GET['year'])          ? (int)$_GET['year']          : null;
            $employeeId   = isset($_GET['employee_id'])   ? (int)$_GET['employee_id']   : null;
            $departmentId = isset($_GET['department_id']) ? (int)$_GET['department_id'] : null;
            $status       = $_GET['status'] ?? null;

            $errors = [];
            if ($year && ($year < 2000 || $year > (int)date('Y'))) {
                $errors['year'] = 'Year must be between 2000 and the current year';
            }
            if ($status && !in_array($status, ['generated', 'sent', 'filed'])) {
                $errors['status'] = 'Status must be one of: generated, sent, filed';
            }
            if (!empty($errors)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Validation failed',
                    code: 400,
                    errors: $errors
                );
            }

            // ── Role-based scoping ───────────────────────────────────────────
            $currentUser     = AuthMiddleware::getCurrentUser();
            $currentEmployee = AuthMiddleware::getCurrentEmployee();

            // p9forms uses no-underscore column names: organizationid, employeeid, year
            $conditions  = ['p9.organizationid = :org_id'];
            $params      = [':org_id' => $org_id];
            $countParams = [':org_id' => $org_id];

            if ($currentUser['user_type'] === 'employee') {
                $conditions[]               = 'p9.employeeid = :scoped_emp';
                $params[':scoped_emp']      = $currentEmployee['id'];
                $countParams[':scoped_emp'] = $currentEmployee['id'];
            }
            if ($year) {
                $conditions[]         = 'p9.year = :year';
                $params[':year']      = $year;
                $countParams[':year'] = $year;
            }
            if ($employeeId && $currentUser['user_type'] !== 'employee') {
                $conditions[]               = 'p9.employeeid = :filter_emp';
                $params[':filter_emp']      = $employeeId;
                $countParams[':filter_emp'] = $employeeId;
            }
            if ($departmentId) {
                $conditions[]            = 'emp.department_id = :dept_id';
                $params[':dept_id']      = $departmentId;
                $countParams[':dept_id'] = $departmentId;
            }
            if ($status) {
                $conditions[]           = 'p9.status = :status';
                $params[':status']      = $status;
                $countParams[':status'] = $status;
            }

            $where = 'WHERE ' . implode(' AND ', $conditions);

            // ── Total count ───────────────────────────────────────────────────
            $total = (int)(DB::raw(
                "SELECT COUNT(*) AS total
                 FROM p9forms p9
                 INNER JOIN employees emp ON emp.id = p9.employeeid
                 $where",
                $countParams
            )[0]->total ?? 0);

            // ── Fetch page ────────────────────────────────────────────────────
            $params[':limit']  = $perPage;
            $params[':offset'] = $offset;

            $rows = DB::raw(
                "SELECT
                    p9.id,
                    p9.organizationid,
                    p9.employeeid,
                    p9.year,
                    p9.p9number,
                    p9.employee_pin,
                    p9.total_basic_salary,
                    p9.total_gross_pay,
                    p9.total_taxable_pay,
                    p9.total_paye,
                    p9.status,
                    p9.pdfpath,
                    p9.generatedat,
                    emp.employee_number,
                    CONCAT(u.first_name, ' ', u.surname) AS employee_name,
                    d.name                               AS department_name
                 FROM p9forms p9
                 INNER JOIN employees   emp ON emp.id = p9.employeeid
                 INNER JOIN users       u   ON u.id   = emp.user_id
                 LEFT  JOIN departments d   ON d.id   = emp.department_id
                 $where
                 ORDER BY p9.year DESC, u.surname ASC
                 LIMIT :limit OFFSET :offset",
                $params
            );

            return responseJson(
                success: true,
                data: [
                    'p9_forms'   => $rows,
                    'pagination' => [
                        'total'        => $total,
                        'per_page'     => $perPage,
                        'current_page' => $page,
                        'last_page'    => (int)ceil($total / $perPage),
                    ],
                ],
                message: 'P9 forms retrieved successfully',
                code: 200
            );

        } catch (\Exception $e) {
            error_log('P9 index error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to retrieve P9 forms: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/organizations/{org_id}/p9-forms/{id}
     *
     * Single P9 form with decoded monthly_data breakdown.
     * monthly_data is returned as a parsed array, not a raw JSON string.
     */
    public function show($org_id = null, $id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }

            $p9 = $this->fetchP9WithMonthlyData((int)$org_id, (int)$id);
            if (!$p9) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'P9 form not found',
                    code: 404
                );
            }

            return responseJson(
                success: true,
                data: $p9,
                message: 'P9 form retrieved successfully',
                code: 200
            );

        } catch (\Exception $e) {
            error_log('P9 show error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to retrieve P9 form: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/organizations/{org_id}/p9-forms/generate
     *
     * Generate (or regenerate) P9 forms from finalized payrun_details.
     *
     * Body (JSON):
     *   year          int      required
     *   employee_ids  int[]    optional — omit to include all active employees
     *   regenerate    bool     optional — overwrite existing 'generated' P9s
     */
    public function generate($org_id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }

            $org = $this->fetchOrg((int)$org_id);
            if (!$org) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Organization not found',
                    code: 404
                );
            }

            $body = json_decode(file_get_contents('php://input'), true) ?? [];

            // ── Validate ──────────────────────────────────────────────────────
            $errors = [];
            if (empty($body['year']) || !is_numeric($body['year'])) {
                $errors['year'] = 'year is required and must be numeric';
            } else {
                $year = (int)$body['year'];
                if ($year < 2000 || $year > (int)date('Y')) {
                    $errors['year'] = 'year must be between 2000 and the current year';
                }
            }
            if (!empty($errors)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Validation failed',
                    code: 400,
                    errors: $errors
                );
            }

            $year        = (int)$body['year'];
            $employeeIds = !empty($body['employee_ids']) && is_array($body['employee_ids'])
                ? array_map('intval', $body['employee_ids'])
                : [];
            $regenerate  = !empty($body['regenerate']);

            // ── Employees in scope ────────────────────────────────────────────
            $employees = $this->fetchEmployeesForP9((int)$org_id, $employeeIds);
            if (empty($employees)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'No active employees found for the given criteria',
                    code: 404
                );
            }

            $generated = [];
            $skipped   = [];
            $failed    = [];

            foreach ($employees as $emp) {
                try {
                    // ── Check for existing P9 this year ──────────────────────
                    $existing = DB::raw(
                        'SELECT id, status FROM p9forms
                         WHERE organizationid = :org AND employeeid = :emp AND year = :yr
                         LIMIT 1',
                        [':org' => $org_id, ':emp' => $emp->id, ':yr' => $year]
                    );

                    if (!empty($existing)) {
                        $ex = $existing[0];
                        if (in_array($ex->status, ['sent', 'filed'])) {
                            $skipped[] = [
                                'employee_id'     => $emp->id,
                                'employee_number' => $emp->employee_number,
                                'reason'          => "P9 already {$ex->status} — cannot regenerate",
                            ];
                            continue;
                        }
                        if (!$regenerate) {
                            $skipped[] = [
                                'employee_id'     => $emp->id,
                                'employee_number' => $emp->employee_number,
                                'reason'          => "P9 already generated for $year. Pass regenerate=true to overwrite.",
                            ];
                            continue;
                        }
                        // Delete the existing 'generated' row so we can re-insert
                        DB::raw('DELETE FROM p9forms WHERE id = :pid', [':pid' => $ex->id]);
                    }

                    // ── Finalized payrun_details for this employee + year ─────
                    $payrunRows = $this->fetchFinalizedPayrunDetails(
                        (int)$org_id,
                        $emp->id,
                        $year
                    );

                    if (empty($payrunRows)) {
                        $skipped[] = [
                            'employee_id'     => $emp->id,
                            'employee_number' => $emp->employee_number,
                            'reason'          => "No finalized payrun records found for $year",
                        ];
                        continue;
                    }

                    // ── Statutory profile ─────────────────────────────────────
                    $profile = $this->fetchEmployeeProfile($emp->id);

                    // ── Compute P9 data ───────────────────────────────────────
                    $p9Data = $this->buildP9Data($emp, $profile, $payrunRows, $year);

                    // ── P9 number: P9-{YEAR}-{EMPLOYEE_NUMBER} ────────────────
                    $p9Number = 'P9-' . $year . '-' . strtoupper($emp->employee_number);

                    // ── Insert into p9forms ───────────────────────────────────
                    DB::table('p9forms')->insert([
                        'organizationid'    => $org_id,
                        'employeeid'        => $emp->id,
                        'year'              => $year,
                        'p9number'          => $p9Number,
                        // employee_profiles.kra_pin → p9forms.employee_pin
                        'employee_pin'      => $profile->kra_pin ?? null,
                        // 4 stored annual total columns
                        'total_basic_salary' => $p9Data['totals']['basic_salary'],
                        'total_gross_pay'    => $p9Data['totals']['gross_pay'],
                        'total_taxable_pay'  => $p9Data['totals']['taxable_pay'],
                        'total_paye'         => $p9Data['totals']['paye'],
                        // Full 12-month breakdown in monthly_data JSON column
                        'monthly_data'       => json_encode($p9Data['monthly_lines'], JSON_UNESCAPED_UNICODE),
                        'pdfpath'            => null,
                        'status'             => 'generated',
                        // generatedat uses DEFAULT CURRENT_TIMESTAMP — not inserted explicitly
                    ]);

                    $p9Id = DB::lastInsertId();

                    $generated[] = [
                        'p9_id'           => $p9Id,
                        'p9number'        => $p9Number,
                        'employee_id'     => $emp->id,
                        'employee_number' => $emp->employee_number,
                        'employee_name'   => $emp->full_name,
                        'year'            => $year,
                        'totals'          => $p9Data['totals'],
                    ];

                } catch (\Exception $empEx) {
                    error_log("P9 generate – employee {$emp->id}: " . $empEx->getMessage());
                    $failed[] = [
                        'employee_id'     => $emp->id,
                        'employee_number' => $emp->employee_number,
                        'reason'          => $empEx->getMessage(),
                    ];
                }
            }

            return responseJson(
                success: true,
                data: [
                    'generated' => $generated,
                    'skipped'   => $skipped,
                    'failed'    => $failed,
                    'summary'   => [
                        'total_employees' => count($employees),
                        'generated_count' => count($generated),
                        'skipped_count'   => count($skipped),
                        'failed_count'    => count($failed),
                    ],
                ],
                message: count($generated) . ' P9 form(s) generated for ' . $year,
                code: 201
            );

        } catch (\Exception $e) {
            error_log('P9 generate error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'P9 generation failed: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/organizations/{org_id}/p9-forms/{id}/send
     *
     * Advance status: 'generated' → 'sent'.
     * Records that the P9 has been distributed to the employee.
     */
    public function markSent($org_id = null, $id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }

            $p9 = $this->fetchP9Header((int)$org_id, (int)$id);
            if (!$p9) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'P9 form not found',
                    code: 404
                );
            }
            if ($p9->status !== 'generated') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only generated P9 forms can be marked as sent. Current status: {$p9->status}",
                    code: 409
                );
            }

            DB::raw(
                "UPDATE p9forms SET status = 'sent' WHERE id = :id",
                [':id' => $id]
            );

            return responseJson(
                success: true,
                data: [
                    'p9_id'    => (int)$id,
                    'p9number' => $p9->p9number,
                    'status'   => 'sent',
                ],
                message: 'P9 form marked as sent to employee',
                code: 200
            );

        } catch (\Exception $e) {
            error_log('P9 markSent error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to mark P9 as sent: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/organizations/{org_id}/p9-forms/{id}/file
     *
     * Advance status: 'sent' → 'filed'.
     * Records that the P9 has been submitted with KRA.
     * Body (optional): { "pdfpath": "/storage/p9/2024/P9-2024-EMP001.pdf" }
     */
    public function markFiled($org_id = null, $id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }

            $p9 = $this->fetchP9Header((int)$org_id, (int)$id);
            if (!$p9) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'P9 form not found',
                    code: 404
                );
            }
            if ($p9->status !== 'sent') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only sent P9 forms can be filed. Current status: {$p9->status}",
                    code: 409
                );
            }

            $body    = json_decode(file_get_contents('php://input'), true) ?? [];
            $pdfPath = $body['pdfpath'] ?? $p9->pdfpath;

            DB::raw(
                "UPDATE p9forms SET status = 'filed', pdfpath = :pdf WHERE id = :id",
                [':pdf' => $pdfPath, ':id' => $id]
            );

            return responseJson(
                success: true,
                data: [
                    'p9_id'    => (int)$id,
                    'p9number' => $p9->p9number,
                    'status'   => 'filed',
                    'pdfpath'  => $pdfPath,
                ],
                message: 'P9 form marked as filed with KRA',
                code: 200
            );

        } catch (\Exception $e) {
            error_log('P9 markFiled error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to mark P9 as filed: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * PATCH /api/v1/organizations/{org_id}/p9-forms/{id}/pdf-path
     *
     * Store the PDF server path after PDF generation.
     * Body: { "pdfpath": "/storage/p9/2024/P9-2024-EMP001.pdf" }
     */
    public function updatePdfPath($org_id = null, $id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }

            $p9 = $this->fetchP9Header((int)$org_id, (int)$id);
            if (!$p9) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'P9 form not found',
                    code: 404
                );
            }

            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            if (empty($body['pdfpath'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Validation failed',
                    code: 400,
                    errors: ['pdfpath' => 'pdfpath is required']
                );
            }

            DB::raw(
                'UPDATE p9forms SET pdfpath = :pdf WHERE id = :id',
                [':pdf' => $body['pdfpath'], ':id' => $id]
            );

            return responseJson(
                success: true,
                data: ['p9_id' => (int)$id, 'pdfpath' => $body['pdfpath']],
                message: 'PDF path updated successfully',
                code: 200
            );

        } catch (\Exception $e) {
            error_log('P9 updatePdfPath error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to update PDF path: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/organizations/{org_id}/p9-forms/bulk-send
     *
     * Mark all 'generated' P9 forms for a year as 'sent' in one call.
     * Body: { "year": 2024 }
     */
    public function bulkSend($org_id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }

            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            $year = isset($body['year']) ? (int)$body['year'] : null;

            if (!$year || $year < 2000 || $year > (int)date('Y')) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'A valid year is required',
                    code: 400,
                    errors: ['year' => 'Must be between 2000 and the current year']
                );
            }

            DB::raw(
                "UPDATE p9forms
                 SET status = 'sent'
                 WHERE organizationid = :org
                   AND year           = :yr
                   AND status         = 'generated'",
                [':org' => $org_id, ':yr' => $year]
            );

            $count = (int)(DB::raw(
                "SELECT COUNT(*) AS c FROM p9forms
                 WHERE organizationid = :org AND year = :yr AND status = 'sent'",
                [':org' => $org_id, ':yr' => $year]
            )[0]->c ?? 0);

            return responseJson(
                success: true,
                data: ['year' => $year, 'sent_count' => $count],
                message: "All generated P9 forms for $year marked as sent",
                code: 200
            );

        } catch (\Exception $e) {
            error_log('P9 bulkSend error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Bulk send failed: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    /**
     * GET /api/v1/organizations/{org_id}/p9-forms/statistics
     *
     * Aggregate totals from p9forms grouped by year and status.
     * Uses the 4 stored total columns directly — no joins needed.
     * Optional filter: ?year=2024
     */
    public function statistics($org_id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }

            $year   = isset($_GET['year']) ? (int)$_GET['year'] : null;
            $where  = 'WHERE organizationid = :org';
            $params = [':org' => $org_id];

            if ($year) {
                $where .= ' AND year = :yr';
                $params[':yr'] = $year;
            }

            $rows = DB::raw(
                "SELECT
                    year,
                    status,
                    COUNT(*)                AS form_count,
                    SUM(total_basic_salary) AS sum_basic_salary,
                    SUM(total_gross_pay)    AS sum_gross_pay,
                    SUM(total_taxable_pay)  AS sum_taxable_pay,
                    SUM(total_paye)         AS sum_paye
                 FROM p9forms
                 $where
                 GROUP BY year, status
                 ORDER BY year DESC",
                $params
            );

            return responseJson(
                success: true,
                data: $rows,
                message: 'P9 statistics retrieved',
                code: 200
            );

        } catch (\Exception $e) {
            error_log('P9 statistics error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to retrieve statistics: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/organizations/{org_id}/employees/{id}/p9-forms
     *
     * All P9 forms for one employee across all years.
     */
    public function employeeP9s($org_id = null, $id = null)
    {
        try {
            if (!$this->validOrgId($org_id)) {
                return $this->badOrgId();
            }

            // Confirm employee belongs to this org via employees.organization_id
            $check = DB::raw(
                'SELECT id FROM employees
                 WHERE id = :emp AND organization_id = :org LIMIT 1',
                [':emp' => $id, ':org' => $org_id]
            );
            if (empty($check)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Employee not found in this organization',
                    code: 404
                );
            }

            // monthly_data intentionally excluded from list view (can be large)
            $rows = DB::raw(
                "SELECT
                    p9.id,
                    p9.year,
                    p9.p9number,
                    p9.employee_pin,
                    p9.total_basic_salary,
                    p9.total_gross_pay,
                    p9.total_taxable_pay,
                    p9.total_paye,
                    p9.status,
                    p9.pdfpath,
                    p9.generatedat
                 FROM p9forms p9
                 WHERE p9.organizationid = :org
                   AND p9.employeeid     = :emp
                 ORDER BY p9.year DESC",
                [':org' => $org_id, ':emp' => $id]
            );

            return responseJson(
                success: true,
                data: $rows,
                message: 'Employee P9 forms retrieved successfully',
                code: 200
            );

        } catch (\Exception $e) {
            error_log('P9 employeeP9s error: ' . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to retrieve employee P9 forms: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    // =========================================================================
    // P9 COMPUTATION ENGINE
    // =========================================================================

    /**
     * Build the full P9 dataset for one employee.
     *
     * Returns:
     *   [
     *     'monthly_lines' => [...],   // 12 entries — stored as monthly_data JSON
     *     'totals'        => [...],   // 4 entries → p9forms total columns
     *                                 // + extras used within monthly_data
     *   ]
     */
    private function buildP9Data(
        object  $emp,
        ?object $profile,
        array   $payrunRows,
        int     $year
    ): array {

        // Index rows by calendar month via payruns.pay_period_start
        $byMonth = [];
        foreach ($payrunRows as $row) {
            $month           = (int)date('n', strtotime($row->pay_period_start));
            $byMonth[$month] = $row;
        }

        $monthlyLines = [];

        // Accumulators — 4 map to p9forms stored columns; rest go to monthly_data only
        $totals = [
            // ── p9forms stored columns ────────────────────────────────────────
            'basic_salary'      => 0,   // → total_basic_salary
            'gross_pay'         => 0,   // → total_gross_pay
            'taxable_pay'       => 0,   // → total_taxable_pay
            'paye'              => 0,   // → total_paye
            // ── monthly_data JSON extras ──────────────────────────────────────
            'nssf'              => 0,
            'shif'              => 0,
            'housing_levy'      => 0,
            'tax_before_relief' => 0,
            'personal_relief'   => 0,
            'insurance_relief'  => 0,
            'net_pay'           => 0,
        ];

        for ($month = 1; $month <= 12; $month++) {
            if (!isset($byMonth[$month])) {
                $monthlyLines[] = $this->zeroLine($year, $month);
                continue;
            }

            $line = $this->buildMonthLine($byMonth[$month], $profile, $year, $month);
            $monthlyLines[] = $line;

            foreach (array_keys($totals) as $k) {
                $totals[$k] += $line[$k] ?? 0;
            }
        }

        foreach ($totals as $k => $v) {
            $totals[$k] = round($v, 2);
        }

        return ['monthly_lines' => $monthlyLines, 'totals' => $totals];
    }

    /**
     * Build one calendar month's P9 line from a payrun_details row.
     *
     * p9forms column mapping:
     *   total_basic_salary ← SUM(line['basic_salary'])
     *   total_gross_pay    ← SUM(line['gross_pay'])
     *   total_taxable_pay  ← SUM(line['taxable_pay'])   (= payrun_details.taxable_income)
     *   total_paye         ← SUM(line['paye'])
     *   monthly_data       ← json_encode(all monthly_lines)
     */
    private function buildMonthLine(object $row, ?object $profile, int $year, int $month): array
    {
        $basicSalary = (float)($row->basic_salary ?? 0);
        $gross       = (float)($row->gross_pay    ?? 0);

        // ── Read stored payrun_details values ─────────────────────────────────
        $nssf           = (float)($row->nssf              ?? 0);
        $shif           = (float)($row->shif              ?? 0);
        $housingLevy    = (float)($row->housing_levy      ?? 0);
        $taxableIncome  = (float)($row->taxable_income    ?? 0);  // → taxable_pay
        $taxBefore      = (float)($row->tax_before_relief ?? 0);
        $personalRelief = (float)($row->personal_relief   ?? 0);
        $paye           = (float)($row->paye              ?? 0);
        $netPay         = (float)($row->net_pay           ?? 0);

        // ── Fallback re-computation for zero / legacy records ─────────────────
        if ($nssf === 0.0) {
            [$nssf] = $this->computeNSSF($gross);
        }
        if ($shif === 0.0) {
            $shif = $this->computeSHIF($gross, $year);
        }
        if ($housingLevy === 0.0) {
            $housingLevy = round($gross * self::AHL_EMPLOYEE_RATE, 2);
        }

        // paye_exemption_amount from employee_profiles (disability / mortgage relief)
        $exemption = (float)($profile->paye_exemption_amount ?? 0);

        if ($taxableIncome === 0.0) {
            $taxableIncome = max(0, round($gross - $nssf - $housingLevy - $exemption, 2));
        }
        if ($taxBefore === 0.0) {
            $taxBefore = $this->computePAYE($taxableIncome);
        }
        if ($personalRelief === 0.0) {
            $personalRelief = self::PERSONAL_RELIEF_MONTHLY;
        }

        // ── Insurance relief via payrun_deductions subquery ───────────────────
        $insurancePremium = (float)($row->insurance_premium ?? 0);
        $insuranceRelief  = min(
            round($insurancePremium * self::INSURANCE_RELIEF_RATE, 2),
            self::INSURANCE_RELIEF_CAP
        );

        // ── Net PAYE after reliefs ────────────────────────────────────────────
        if ($paye === 0.0) {
            $paye = max(0, round($taxBefore - $personalRelief - $insuranceRelief, 2));
        }

        return [
            // ── Maps to p9forms total columns (accumulated in buildP9Data) ─────
            'basic_salary'      => round($basicSalary,   2),  // → total_basic_salary
            'gross_pay'         => round($gross,         2),  // → total_gross_pay
            'taxable_pay'       => round($taxableIncome, 2),  // → total_taxable_pay
            'paye'              => round($paye,          2),  // → total_paye
            // ── Stored in monthly_data JSON only ─────────────────────────────
            'month'             => $month,
            'month_name'        => date('F', mktime(0, 0, 0, $month, 1)),
            'year'              => $year,
            'payrun_id'         => (int)($row->payrun_id        ?? 0),
            'payrun_detail_id'  => (int)($row->payrun_detail_id ?? 0),
            'overtime_amount'   => round((float)($row->overtime_amount   ?? 0), 2),
            'bonus_amount'      => round((float)($row->bonus_amount      ?? 0), 2),
            'commission_amount' => round((float)($row->commission_amount ?? 0), 2),
            'nssf'              => round($nssf,           2),
            'shif'              => round($shif,           2),
            'housing_levy'      => round($housingLevy,    2),
            'tax_before_relief' => round($taxBefore,      2),
            'personal_relief'   => round($personalRelief, 2),
            'insurance_relief'  => round($insuranceRelief,2),
            'net_pay'           => round($netPay,         2),
        ];
    }

    // ── Statutory helpers ─────────────────────────────────────────────────────

    /** PAYE on monthly taxable pay — Finance Act 2023 bands. */
    private function computePAYE(float $taxable): float
    {
        $tax = $remaining = 0;
        $prev = 0;

        // Reset accumulator
        $tax = 0;
        $remaining = $taxable;

        foreach (self::PAYE_BANDS as [$limit, $rate]) {
            if ($remaining <= 0) {
                break;
            }
            $band       = min($remaining, $limit - $prev);
            $tax       += $band * $rate;
            $remaining -= $band;
            $prev       = $limit;
        }

        return round($tax, 2);
    }

    /**
     * NSSF Act 2013 Tier I + Tier II.
     * Returns [employee_contribution, employer_contribution].
     */
    private function computeNSSF(float $gross): array
    {
        $pensionable = min($gross, self::NSSF_UEL);
        $tierI       = self::NSSF_LEL * self::NSSF_RATE;                        // = 360
        $tierII      = max(0, $pensionable - self::NSSF_LEL) * self::NSSF_RATE; // max = 720
        $employee    = round($tierI + $tierII, 2);
        return [$employee, $employee]; // employer matches
    }

    /** SHIF 2.75% (min 300) from 2024; legacy NHIF bands for prior years. */
    private function computeSHIF(float $gross, int $year): float
    {
        if ($year >= 2024) {
            return max(self::SHIF_MINIMUM, round($gross * self::SHIF_RATE, 2));
        }
        return $this->legacyNHIF($gross);
    }

    /** NHIF statutory bands — valid until September 2024. */
    private function legacyNHIF(float $gross): float
    {
        $bands = [
            [5999, 150],   [7999, 300],   [11999, 400],  [14999, 500],
            [19999, 600],  [24999, 750],  [29999, 850],  [34999, 900],
            [39999, 950],  [44999, 1000], [49999, 1100], [59999, 1200],
            [69999, 1300], [79999, 1400], [89999, 1500], [99999, 1600],
            [PHP_INT_MAX, 1700],
        ];
        foreach ($bands as [$limit, $contribution]) {
            if ($gross <= $limit) {
                return (float)$contribution;
            }
        }
        return 1700.0;
    }

    /** Zero-filled month line for months that had no payrun. */
    private function zeroLine(int $year, int $month): array
    {
        return [
            'basic_salary'      => 0,
            'gross_pay'         => 0,
            'taxable_pay'       => 0,
            'paye'              => 0,
            'month'             => $month,
            'month_name'        => date('F', mktime(0, 0, 0, $month, 1)),
            'year'              => $year,
            'payrun_id'         => null,
            'payrun_detail_id'  => null,
            'overtime_amount'   => 0,
            'bonus_amount'      => 0,
            'commission_amount' => 0,
            'nssf'              => 0,
            'shif'              => 0,
            'housing_levy'      => 0,
            'tax_before_relief' => 0,
            'personal_relief'   => 0,
            'insurance_relief'  => 0,
            'net_pay'           => 0,
        ];
    }

    // =========================================================================
    // DATA HELPERS
    // =========================================================================

    private function orgExists(int $orgId): bool
    {
        return !empty(DB::raw(
            'SELECT id FROM organizations WHERE id = :id LIMIT 1',
            [':id' => $orgId]
        ));
    }

    private function fetchOrg(int $orgId): ?object
    {
        $rows = DB::table('organizations')->where(['id' => $orgId])->get();
        return $rows[0] ?? null;
    }

    /**
     * Fetch a p9forms header row (excludes monthly_data to keep it lightweight).
     * Scoped to org via organizationid FK.
     */
    private function fetchP9Header(int $orgId, int $id): ?object
    {
        $rows = DB::raw(
            'SELECT id, organizationid, employeeid, year, p9number, employee_pin,
                    total_basic_salary, total_gross_pay, total_taxable_pay,
                    total_paye, status, pdfpath, generatedat
             FROM   p9forms
             WHERE  id = :id AND organizationid = :org
             LIMIT  1',
            [':id' => $id, ':org' => $orgId]
        );
        return $rows[0] ?? null;
    }

    /**
     * Fetch full p9forms row and decode monthly_data JSON into a PHP array.
     * Also joins employee name, department, and org employer_pin for context.
     */
    private function fetchP9WithMonthlyData(int $orgId, int $id): ?array
    {
        $rows = DB::raw(
            "SELECT
                p9.id,
                p9.organizationid,
                p9.employeeid,
                p9.year,
                p9.p9number,
                p9.employee_pin,
                p9.total_basic_salary,
                p9.total_gross_pay,
                p9.total_taxable_pay,
                p9.total_paye,
                p9.monthly_data,
                p9.pdfpath,
                p9.status,
                p9.generatedat,
                emp.employee_number,
                CONCAT(u.first_name, ' ', u.surname) AS employee_name,
                d.name   AS department_name,
                org.name AS organization_name,
                org.kra_pin AS employer_pin
             FROM  p9forms p9
             INNER JOIN employees    emp ON emp.id  = p9.employeeid
             INNER JOIN users        u   ON u.id    = emp.user_id
             INNER JOIN organizations org ON org.id = p9.organizationid
             LEFT  JOIN departments  d   ON d.id    = emp.department_id
             WHERE p9.id = :id AND p9.organizationid = :org
             LIMIT 1",
            [':id' => $id, ':org' => $orgId]
        );

        if (empty($rows)) {
            return null;
        }

        $record      = $rows[0];
        $monthlyData = null;

        if (!empty($record->monthly_data)) {
            $monthlyData = json_decode($record->monthly_data, true);
        }

        // Remove the raw JSON string from the record before returning
        unset($record->monthly_data);

        return [
            'p9_form'      => $record,
            'monthly_data' => $monthlyData,
        ];
    }

    /**
     * Fetch employee_profiles row.
     * kra_pin  → p9forms.employee_pin
     * paye_exemption_amount → reduces taxable_pay in fallback computation
     */
    private function fetchEmployeeProfile(int $employeeId): ?object
    {
        $rows = DB::raw(
            'SELECT * FROM employee_profiles WHERE employee_id = :emp LIMIT 1',
            [':emp' => $employeeId]
        );
        return $rows[0] ?? null;
    }

    /**
     * Fetch active employees scoped to org.
     * employees.organization_id is the direct FK — no cross-table org check needed.
     * users joined for first_name + surname (no computed full_name column in schema).
     */
    private function fetchEmployeesForP9(int $orgId, array $employeeIds): array
    {
        $sql = "SELECT
                    e.id,
                    e.employee_number,
                    e.department_id,
                    e.organization_id,
                    e.base_salary,
                    CONCAT(u.first_name, ' ', u.surname) AS full_name
                FROM employees e
                INNER JOIN users u ON u.id = e.user_id
                WHERE e.organization_id = :org
                  AND e.status = 'active'";

        if (!empty($employeeIds)) {
            $ph  = implode(',', array_fill(0, count($employeeIds), '?'));
            $sql = str_replace(':org', '?', $sql) . " AND e.id IN ($ph)";
            return DB::raw($sql, array_merge([$orgId], $employeeIds));
        }

        return DB::raw($sql, [':org' => $orgId]);
    }

    /**
     * Fetch finalized payrun_details rows for one employee in a given year.
     *
     * Joins:
     *   payruns           → status='finalized', deleted_at IS NULL,
     *                       pay_period_start used to derive calendar month
     *   payrun_details    → all pre-computed statutory columns
     *   payrun_deductions → insurance premiums via subquery
     *                       (organization_configs config_type='benefit'
     *                        AND name LIKE '%insurance%' AND is_active=1)
     */
    private function fetchFinalizedPayrunDetails(int $orgId, int $employeeId, int $year): array
    {
        return DB::raw(
            "SELECT
                pd.id                   AS payrun_detail_id,
                pd.payrun_id,
                pd.basic_salary,
                pd.overtime_amount,
                pd.bonus_amount,
                pd.commission_amount,
                pd.gross_pay,
                pd.nssf,
                pd.shif,
                pd.housing_levy,
                pd.taxable_income,
                pd.tax_before_relief,
                pd.personal_relief,
                pd.paye,
                pd.total_deductions,
                pd.net_pay,
                pr.pay_period_start,
                pr.pay_period_end,
                COALESCE((
                    SELECT SUM(pded.amount)
                    FROM   payrun_deductions pded
                    INNER  JOIN organization_configs oc
                           ON  oc.id          = pded.config_id
                           AND oc.config_type = 'benefit'
                           AND oc.name        LIKE '%insurance%'
                           AND oc.is_active   = 1
                    WHERE  pded.payrun_detail_id = pd.id
                ), 0) AS insurance_premium
             FROM payrun_details pd
             INNER JOIN payruns pr
                     ON  pr.id              = pd.payrun_id
                     AND pr.organization_id = :org
                     AND pr.status          = 'finalized'
                     AND pr.deleted_at      IS NULL
                     AND YEAR(pr.pay_period_start) = :yr
             WHERE pd.employee_id     = :emp
               AND pd.organization_id = :org2
             ORDER BY pr.pay_period_start ASC",
            [
                ':org'  => $orgId,
                ':yr'   => $year,
                ':emp'  => $employeeId,
                ':org2' => $orgId,
            ]
        );
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    private function validOrgId($v): bool
    {
        return $v && is_numeric($v);
    }

    private function badOrgId()
    {
        return responseJson(
            success: false,
            data: null,
            message: 'Invalid or missing organization ID',
            code: 400,
            errors: ['org_id' => 'Organization ID is required and must be a valid number']
        );
    }
}