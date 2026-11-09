<?php

namespace App\Controllers;

use App\Services\DB;

class AuditLogController
{
    /**
     * Human-readable label lookups for entity_type => [table, label SQL].
     * entity_type values come from what the controllers write into audit_logs.
     * payrun_details logs use the payrun id as entity_id, so it resolves via payruns.
     */
    private const ENTITY_LABELS = [
        'departments'         => ['departments', 'name'],
        'job_titles'          => ['job_titles', 'title'],
        'payruns'             => ['payruns', 'payrun_name'],
        'payrun_details'      => ['payruns', 'payrun_name'],
        'organization_config' => ['organization_configs', 'name'],
        'advance'             => ['advances', 'advance_number'],
        'reimbursements'      => ['reimbursements', 'reimbursement_number'],
    ];

    /**
     * GET /organizations/{org_id}/audit-logs
     * Filters: entity_type, entity_id, action, user_id, date_from (Y-m-d), date_to (Y-m-d),
     *          search (free text), page, per_page
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

            $orgCheck = DB::table('organizations')->where(['id' => $org_id])->get();
            if (empty($orgCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Organization not found",
                    code: 404,
                    errors: ['org_id' => "No organization found with ID: $org_id"]
                );
            }

            $page    = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 10;
            $offset  = ($page - 1) * $perPage;

            $entityType = trim((string) ($_GET['entity_type'] ?? ''));
            $entityId   = $_GET['entity_id'] ?? '';
            $action     = trim((string) ($_GET['action'] ?? ''));
            $userId     = $_GET['user_id'] ?? '';
            $dateFrom   = trim((string) ($_GET['date_from'] ?? ''));
            $dateTo     = trim((string) ($_GET['date_to'] ?? ''));
            $search     = trim((string) ($_GET['search'] ?? ''));

            $errors = [];
            if ($entityId !== '' && !ctype_digit((string) $entityId)) {
                $errors['entity_id'] = 'entity_id must be a number';
            }
            if ($userId !== '' && !ctype_digit((string) $userId)) {
                $errors['user_id'] = 'user_id must be a number';
            }
            if ($dateFrom !== '' && !$this->isValidDate($dateFrom)) {
                $errors['date_from'] = 'date_from must be in YYYY-MM-DD format';
            }
            if ($dateTo !== '' && !$this->isValidDate($dateTo)) {
                $errors['date_to'] = 'date_to must be in YYYY-MM-DD format';
            }
            if (!empty($errors)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid filter values",
                    code: 422,
                    errors: $errors
                );
            }

            $where  = ["audit_logs.organization_id = :org_id"];
            $params = [':org_id' => $org_id];

            if ($entityType !== '') {
                $where[] = "audit_logs.entity_type = :f_entity_type";
                $params[':f_entity_type'] = $entityType;
            }
            if ($entityId !== '') {
                $where[] = "audit_logs.entity_id = :f_entity_id";
                $params[':f_entity_id'] = (int) $entityId;
            }
            if ($action !== '') {
                $where[] = "audit_logs.action = :f_action";
                $params[':f_action'] = $action;
            }
            if ($userId !== '') {
                $where[] = "audit_logs.user_id = :f_user_id";
                $params[':f_user_id'] = (int) $userId;
            }
            if ($dateFrom !== '') {
                $where[] = "audit_logs.created_at >= :f_date_from";
                $params[':f_date_from'] = $dateFrom . ' 00:00:00';
            }
            if ($dateTo !== '') {
                // inclusive end date: strictly before the next day
                $where[] = "audit_logs.created_at < :f_date_to";
                $params[':f_date_to'] = date('Y-m-d', strtotime($dateTo . ' +1 day')) . ' 00:00:00';
            }
            if ($search !== '') {
                $like = '%' . addcslashes($search, '\\%_') . '%';
                $where[] = "(
                    emp.firstname LIKE :s1
                    OR emp.surname LIKE :s2
                    OR users.email LIKE :s3
                    OR COALESCE(NULLIF(TRIM(CONCAT(emp.firstname, ' ', emp.surname)), ''), users.username) LIKE :s4
                    OR audit_logs.entity_type LIKE :s5
                    OR audit_logs.action LIKE :s6
                    OR CAST(audit_logs.entity_id AS CHAR) LIKE :s7
                    OR CAST(audit_logs.details AS CHAR) LIKE :s8
                )";
                for ($i = 1; $i <= 8; $i++) {
                    $params[":s$i"] = $like;
                }
            }

            $whereClause = 'WHERE ' . implode(' AND ', $where);

            $countResult = DB::raw("
                SELECT COUNT(*) AS total
                FROM audit_logs
                LEFT JOIN users ON audit_logs.user_id = users.id
                LEFT JOIN employees emp ON emp.user_id = users.id
                $whereClause
            ", $params);
            $total = (int) ($countResult[0]->total ?? 0);

            // $perPage and $offset are cast to int above, so inlining them is safe
            $auditLogs = DB::raw("
                SELECT
                    audit_logs.*,
                    emp.firstname AS user_first_name,
                    emp.surname AS user_surname,
                    users.email AS user_email,
                    users.user_type AS user_role,
                    COALESCE(NULLIF(TRIM(CONCAT(emp.firstname, ' ', emp.surname)), ''), users.username) AS user_full_name
                FROM audit_logs
                LEFT JOIN users ON audit_logs.user_id = users.id
                LEFT JOIN employees emp ON emp.user_id = users.id
                $whereClause
                ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
                LIMIT $perPage OFFSET $offset
            ", $params);

            foreach ($auditLogs as $log) {
                if ($log->details) {
                    $log->details = json_decode($log->details, true);
                }
            }

            $this->attachEntityNames($auditLogs, (int) $org_id);

            $totalPages = (int) ceil($total / $perPage);

            return responseJson(
                success: true,
                data: $auditLogs,
                message: "Fetched Audit Logs Successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => $total,
                        'total_pages'  => $totalPages,
                        'has_next'     => $page < $totalPages,
                        'has_prev'     => $page > 1,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Audit log index error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());

            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch audit logs",
                code: 500
            );
        }
    }

    /**
     * GET /organizations/{org_id}/audit-logs/filters
     * Distinct values used to populate the filter dropdowns on the UI.
     */
    public function filters($org_id = null)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 404
                );
            }

            $entityTypes = DB::raw(
                "SELECT DISTINCT entity_type FROM audit_logs WHERE organization_id = :org_id ORDER BY entity_type",
                [':org_id' => $org_id]
            );
            $actions = DB::raw(
                "SELECT DISTINCT action FROM audit_logs WHERE organization_id = :org_id ORDER BY action",
                [':org_id' => $org_id]
            );
            $users = DB::raw("
                SELECT DISTINCT
                    users.id,
                    COALESCE(NULLIF(TRIM(CONCAT(emp.firstname, ' ', emp.surname)), ''), users.username) AS full_name,
                    users.email
                FROM audit_logs
                INNER JOIN users ON audit_logs.user_id = users.id
                LEFT JOIN employees emp ON emp.user_id = users.id
                WHERE audit_logs.organization_id = :org_id
                ORDER BY full_name
            ", [':org_id' => $org_id]);

            return responseJson(
                success: true,
                data: [
                    'entity_types' => array_map(fn($r) => $r->entity_type, $entityTypes),
                    'actions'      => array_map(fn($r) => $r->action, $actions),
                    'users'        => $users,
                ],
                message: "Fetched audit log filters successfully"
            );
        } catch (\Exception $e) {
            error_log("Audit log filters error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch audit log filters",
                code: 500
            );
        }
    }

    /**
     * GET /organizations/{org_id}/audit-logs/{id}
     */
    public function show($org_id, $id)
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

            if (!$id || !is_numeric($id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing audit log ID",
                    code: 404,
                    errors: ['id' => 'Audit log ID is required and must be a valid number']
                );
            }

            $auditLog = DB::raw("
                SELECT
                    audit_logs.*,
                    emp.firstname AS user_first_name,
                    emp.surname AS user_surname,
                    users.email AS user_email,
                    users.user_type AS user_role,
                    COALESCE(NULLIF(TRIM(CONCAT(emp.firstname, ' ', emp.surname)), ''), users.username) AS user_full_name
                FROM audit_logs
                LEFT JOIN users ON audit_logs.user_id = users.id
                LEFT JOIN employees emp ON emp.user_id = users.id
                WHERE audit_logs.id = :id AND audit_logs.organization_id = :org_id
            ", [':id' => $id, ':org_id' => $org_id]);

            if (empty($auditLog)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Audit log not found",
                    code: 404
                );
            }

            if ($auditLog[0]->details) {
                $auditLog[0]->details = json_decode($auditLog[0]->details, true);
            }

            $this->attachEntityNames($auditLog, (int) $org_id);

            return responseJson(
                success: true,
                data: $auditLog[0],
                message: "Audit log fetched successfully"
            );
        } catch (\Exception $e) {
            error_log("Audit log show error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch audit log",
                code: 500
            );
        }
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private function isValidDate(string $value): bool
    {
        $d = \DateTime::createFromFormat('Y-m-d', $value);
        return $d && $d->format('Y-m-d') === $value;
    }

    /**
     * Adds `entity_name` to each row: the current name of the referenced record
     * (one query per entity type, not per row). Null when the record no longer
     * exists (e.g. deleted) or the type has no resolver; the UI then falls back
     * to the name stored in details.
     */
    private function attachEntityNames(array $logs, int $orgId): void
    {
        $idsByType = [];
        foreach ($logs as $log) {
            if (isset(self::ENTITY_LABELS[$log->entity_type])) {
                $idsByType[$log->entity_type][(int) $log->entity_id] = true;
            }
        }

        $names = []; // [entity_type][id] => label
        foreach ($idsByType as $type => $idSet) {
            [$table, $column] = self::ENTITY_LABELS[$type];
            $ids = array_keys($idSet);

            $params = [':org_id' => $orgId];
            $holders = [];
            foreach ($ids as $i => $id) {
                $holders[] = ":id$i";
                $params[":id$i"] = $id;
            }

            try {
                // $table / $column come from the constant map above, never from user input
                $rows = DB::raw(
                    "SELECT id, `$column` AS label FROM `$table`
                     WHERE organization_id = :org_id AND id IN (" . implode(',', $holders) . ")",
                    $params
                );
                foreach ($rows as $row) {
                    $names[$type][(int) $row->id] = $row->label;
                }
            } catch (\Exception $e) {
                error_log("Audit log name resolution failed for $type: " . $e->getMessage());
            }
        }

        foreach ($logs as $log) {
            $log->entity_name = $names[$log->entity_type][(int) $log->entity_id] ?? null;
        }
    }
}