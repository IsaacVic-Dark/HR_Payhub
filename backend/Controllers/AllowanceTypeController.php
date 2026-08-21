<?php

namespace App\Controllers;

use App\Services\DB;

/**
 * AllowanceTypeController
 *
 * CRUD for the org-level allowance catalogue (allowance_types). This is
 * configuration, not a workflow — analogous to OrganizationConfigController —
 * so there's no approval step here (approval lives on employee_allowance).
 *
 * Phase 1 only evaluates calculation_method IN (FIXED_AMOUNT,
 * PERCENTAGE_OF_BASIC, PERCENTAGE_OF_GROSS) in PayrunProcessingService, so
 * store()/update() reject the other enum values for now rather than let an
 * org silently create an allowance type that will never resolve to money.
 */
class AllowanceTypeController
{
    private const SUPPORTED_CALCULATION_METHODS = ['FIXED_AMOUNT', 'PERCENTAGE_OF_BASIC', 'PERCENTAGE_OF_GROSS'];
    private const VALID_CATEGORIES = ['housing', 'transport', 'meal', 'medical', 'travel', 'responsibility'];
    private const VALID_PAYMENT_NATURES = ['cash', 'non_cash'];
    private const VALID_FREQUENCIES = ['one_time', 'monthly', 'weekly', 'daily', 'per_pay_run', 'per_event'];
    private const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];

    /**
     * List allowance types for an organisation.
     * GET /api/v1/organizations/{org_id}/allowance-types?category=&status=&search=&page=&per_page=
     */
    public function index($org_id = null)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']
                );
            }

            $page    = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 20;
            $offset  = ($page - 1) * $perPage;

            $where  = ['organization_id = :org_id'];
            $params = [':org_id' => $org_id];

            if (!empty($_GET['category']) && in_array($_GET['category'], self::VALID_CATEGORIES, true)) {
                $where[] = 'category = :category';
                $params[':category'] = $_GET['category'];
            }

            if (!empty($_GET['status']) && in_array($_GET['status'], self::VALID_STATUSES, true)) {
                $where[] = 'status = :status';
                $params[':status'] = $_GET['status'];
            } else {
                // Default to hiding archived types from the normal listing
                $where[] = "status <> 'ARCHIVED'";
            }

            if (!empty($_GET['search'])) {
                $where[] = '(name LIKE :search OR code LIKE :search)';
                $params[':search'] = '%' . $_GET['search'] . '%';
            }

            $whereClause = implode(' AND ', $where);

            $countRows = DB::raw(
                "SELECT COUNT(*) as total FROM allowance_types WHERE {$whereClause}",
                $params
            );
            $total = (int) ($countRows[0]->total ?? 0);

            $params[':limit']  = $perPage;
            $params[':offset'] = $offset;

            $rows = DB::raw(
                "SELECT * FROM allowance_types
                  WHERE {$whereClause}
                  ORDER BY name ASC
                  LIMIT :limit OFFSET :offset",
                $params
            );

            return responseJson(
                success: true,
                data: $rows,
                message: "Fetched allowance types successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => $total,
                        'total_pages'  => (int) ceil($total / $perPage),
                        'has_next'     => $page < ceil($total / $perPage),
                        'has_prev'     => $page > 1,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("AllowanceTypeController::index error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch allowance types",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    /**
     * GET /api/v1/organizations/{org_id}/allowance-types/{id}
     */
    public function show($org_id, $id)
    {
        try {
            $rows = DB::raw(
                "SELECT * FROM allowance_types WHERE id = :id AND organization_id = :org_id",
                [':id' => $id, ':org_id' => $org_id]
            );

            if (empty($rows)) {
                return responseJson(success: false, data: null, message: "Allowance type not found", code: 404);
            }

            return responseJson(success: true, data: $rows[0], message: "Fetched allowance type successfully");
        } catch (\Exception $e) {
            error_log("AllowanceTypeController::show error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to fetch allowance type", code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/allowance-types
     * Body: { name, code, category, payment_nature?, frequency?, calculation_method,
     *         amount?, percentage?, is_recurring?, requires_receipt?,
     *         taxable_income?, taxable_limit?, effective_from?, effective_to?, status?, description? }
     */
    public function store($org_id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $required = ['name', 'code', 'category', 'calculation_method'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return responseJson(success: false, data: null, message: "Field '$field' is required", code: 400);
                }
            }

            $validationError = $this->validatePayload($data);
            if ($validationError) {
                return responseJson(success: false, data: null, message: $validationError, code: 400);
            }

            $existing = DB::raw(
                "SELECT id FROM allowance_types WHERE organization_id = :org_id AND code = :code",
                [':org_id' => $org_id, ':code' => $data['code']]
            );
            if (!empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "An allowance type with code '{$data['code']}' already exists for this organisation",
                    code: 409
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            $insertData = [
                'organization_id'    => $org_id,
                'name'               => $data['name'],
                'code'               => $data['code'],
                'description'        => $data['description'] ?? null,
                'category'           => $data['category'],
                'payment_nature'     => $data['payment_nature'] ?? 'cash',
                'frequency'          => $data['frequency'] ?? 'monthly',
                'calculation_method' => $data['calculation_method'],
                'amount'             => $data['amount'] ?? null,
                'percentage'         => $data['percentage'] ?? null,
                'formula_expression' => $data['formula_expression'] ?? null,
                'unit_name'          => $data['unit_name'] ?? null,
                'is_recurring'       => isset($data['is_recurring']) ? (int) (bool) $data['is_recurring'] : 1,
                'requires_receipt'   => isset($data['requires_receipt']) ? (int) (bool) $data['requires_receipt'] : 0,
                'taxable_income'     => isset($data['taxable_income']) ? (int) (bool) $data['taxable_income'] : 1,
                'taxable_limit'      => $data['taxable_limit'] ?? null,
                'effective_from'     => $data['effective_from'] ?? null,
                'effective_to'       => $data['effective_to'] ?? null,
                'status'             => $data['status'] ?? 'ACTIVE',
                'created_by'         => $currentUser['id'] ?? null,
            ];

            DB::table('allowance_types')->insert($insertData);
            $id = DB::lastInsertId();

            $created = DB::raw("SELECT * FROM allowance_types WHERE id = :id", [':id' => $id]);

            return responseJson(
                success: true,
                data: $created[0] ?? null,
                message: "Allowance type created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("AllowanceTypeController::store error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create allowance type",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    /**
     * PUT/PATCH /api/v1/organizations/{org_id}/allowance-types/{id}
     */
    public function update($org_id, $id)
    {
        try {
            $existing = DB::raw(
                "SELECT * FROM allowance_types WHERE id = :id AND organization_id = :org_id",
                [':id' => $id, ':org_id' => $org_id]
            );
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Allowance type not found", code: 404);
            }
            $current = $existing[0];

            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            // Merge over existing so partial updates (PATCH) work the same as PUT
            $merged = [
                'name'               => $data['name']               ?? $current->name,
                'category'           => $data['category']           ?? $current->category,
                'payment_nature'     => $data['payment_nature']     ?? $current->payment_nature,
                'frequency'          => $data['frequency']          ?? $current->frequency,
                'calculation_method' => $data['calculation_method'] ?? $current->calculation_method,
                'amount'             => array_key_exists('amount', $data)     ? $data['amount']     : $current->amount,
                'percentage'         => array_key_exists('percentage', $data) ? $data['percentage'] : $current->percentage,
                'taxable_income'     => array_key_exists('taxable_income', $data) ? (int) (bool) $data['taxable_income'] : (int) $current->taxable_income,
                'taxable_limit'      => array_key_exists('taxable_limit', $data)  ? $data['taxable_limit']  : $current->taxable_limit,
            ];

            $validationError = $this->validatePayload($merged);
            if ($validationError) {
                return responseJson(success: false, data: null, message: $validationError, code: 400);
            }

            if (isset($data['code']) && $data['code'] !== $current->code) {
                $codeClash = DB::raw(
                    "SELECT id FROM allowance_types WHERE organization_id = :org_id AND code = :code AND id <> :id",
                    [':org_id' => $org_id, ':code' => $data['code'], ':id' => $id]
                );
                if (!empty($codeClash)) {
                    return responseJson(success: false, data: null, message: "Code '{$data['code']}' is already in use", code: 409);
                }
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            $updateData = array_merge($merged, [
                'code'               => $data['code']               ?? $current->code,
                'description'        => array_key_exists('description', $data) ? $data['description'] : $current->description,
                'formula_expression' => array_key_exists('formula_expression', $data) ? $data['formula_expression'] : $current->formula_expression,
                'unit_name'          => array_key_exists('unit_name', $data) ? $data['unit_name'] : $current->unit_name,
                'is_recurring'       => isset($data['is_recurring']) ? (int) (bool) $data['is_recurring'] : (int) $current->is_recurring,
                'requires_receipt'   => isset($data['requires_receipt']) ? (int) (bool) $data['requires_receipt'] : (int) $current->requires_receipt,
                'effective_from'     => array_key_exists('effective_from', $data) ? $data['effective_from'] : $current->effective_from,
                'effective_to'       => array_key_exists('effective_to', $data) ? $data['effective_to'] : $current->effective_to,
                'status'             => $data['status'] ?? $current->status,
                'updated_by'         => $currentUser['id'] ?? null,
            ]);

            if (!in_array($updateData['status'], self::VALID_STATUSES, true)) {
                return responseJson(success: false, data: null, message: "Invalid status value", code: 400);
            }

            DB::table('allowance_types')->update($updateData, 'id', $id);

            $updated = DB::raw("SELECT * FROM allowance_types WHERE id = :id", [':id' => $id]);

            return responseJson(success: true, data: $updated[0] ?? null, message: "Allowance type updated successfully");
        } catch (\Exception $e) {
            error_log("AllowanceTypeController::update error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update allowance type",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    /**
     * DELETE /api/v1/organizations/{org_id}/allowance-types/{id}
     * Soft-delete: flips status to ARCHIVED rather than a hard delete, since
     * live employee_allowance rows may reference this type (FK is CASCADE,
     * so a hard delete would silently wipe employee grant history).
     */
    public function destroy($org_id, $id)
    {
        try {
            $existing = DB::raw(
                "SELECT id FROM allowance_types WHERE id = :id AND organization_id = :org_id",
                [':id' => $id, ':org_id' => $org_id]
            );
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Allowance type not found", code: 404);
            }

            $inUse = DB::raw(
                "SELECT COUNT(*) as cnt FROM employee_allowance
                  WHERE allowance_type_id = :id AND status IN ('APPROVED', 'PENDING_APPROVAL')",
                [':id' => $id]
            );

            if ((int) ($inUse[0]->cnt ?? 0) > 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot delete an allowance type with active or pending employee grants — archive it instead or reassign those grants first",
                    code: 409
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            DB::table('allowance_types')->update(
                ['status' => 'ARCHIVED', 'updated_by' => $currentUser['id'] ?? null],
                'id',
                $id
            );

            return responseJson(success: true, data: null, message: "Allowance type archived successfully");
        } catch (\Exception $e) {
            error_log("AllowanceTypeController::destroy error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to delete allowance type", code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // Validation helpers
    // -------------------------------------------------------------------------

    private function validatePayload(array $data): ?string
    {
        if (isset($data['category']) && !in_array($data['category'], self::VALID_CATEGORIES, true)) {
            return "Invalid category. Must be one of: " . implode(', ', self::VALID_CATEGORIES);
        }

        if (isset($data['payment_nature']) && !in_array($data['payment_nature'], self::VALID_PAYMENT_NATURES, true)) {
            return "Invalid payment_nature. Must be one of: " . implode(', ', self::VALID_PAYMENT_NATURES);
        }

        if (isset($data['frequency']) && !in_array($data['frequency'], self::VALID_FREQUENCIES, true)) {
            return "Invalid frequency. Must be one of: " . implode(', ', self::VALID_FREQUENCIES);
        }

        if (isset($data['calculation_method']) && !in_array($data['calculation_method'], self::SUPPORTED_CALCULATION_METHODS, true)) {
            return "calculation_method '{$data['calculation_method']}' is not yet supported by payroll processing. "
                 . "Supported methods: " . implode(', ', self::SUPPORTED_CALCULATION_METHODS);
        }

        if (($data['calculation_method'] ?? null) === 'FIXED_AMOUNT' && empty($data['amount']) && $data['amount'] !== 0) {
            return "amount is required when calculation_method is FIXED_AMOUNT";
        }

        if (in_array($data['calculation_method'] ?? null, ['PERCENTAGE_OF_BASIC', 'PERCENTAGE_OF_GROSS'], true)
            && !isset($data['percentage'])
        ) {
            return "percentage is required when calculation_method is PERCENTAGE_OF_BASIC or PERCENTAGE_OF_GROSS";
        }

        if (isset($data['percentage']) && ($data['percentage'] < 0 || $data['percentage'] > 100)) {
            return "percentage must be between 0 and 100";
        }

        if (isset($data['taxable_limit']) && $data['taxable_limit'] !== null && (float) $data['taxable_limit'] < 0) {
            return "taxable_limit cannot be negative";
        }

        if (array_key_exists('taxable_income', $data)
            && (int) (bool) $data['taxable_income'] === 0
            && !empty($data['taxable_limit'])
        ) {
            return "taxable_limit is not applicable when taxable_income is false";
        }

        return null;
    }
}