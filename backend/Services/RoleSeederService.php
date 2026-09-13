<?php
// app/Services/RoleSeederService.php

namespace App\Services;

/**
 * RoleSeederService
 *
 * Seeds the 10 default roles (matching the old `users.user_type` ENUM) and
 * their default permission grants for a single organization.
 *
 * Call seedForOrganization() from:
 *   - RegistrationController, right after a new organization row is created.
 *   - OrganizationController::store(), the second (admin-panel) org-creation path.
 *   - scripts/seed_existing_organizations_roles.php, once, to backfill
 *     roles for organizations that already exist in the dev database.
 *
 * Idempotent: safe to call twice for the same org — it checks for an
 * existing role by slug before inserting, and uses INSERT IGNORE for the
 * permission grants (unique key on role_id+permission_id).
 *
 * DEFAULT_MATRIX below is a best-effort reconstruction of the access rules
 * already encoded in the middleware/controller switch-statements this
 * replaced, audited module by module — see /docs/rbac.md for the full
 * per-module breakdown and the specific deviations that were made
 * deliberately (flagged there, not silently changed).
 */
class RoleSeederService
{
    /**
     * role_slug => [ permission_name => scope, ... ]
     * scope is one of: 'own' | 'team' | 'department' | 'all'
     */
    private const DEFAULT_MATRIX = [

        'super_admin' => [
            'organizations.manage_platform' => 'all',
            // Deliberately NOT granted: organizations.access_tenant_data.
            // That's what keeps super_admin locked out of tenant org data —
            // see AuthMiddleware::belongsToPlatformAccount().
        ],

        'admin' => [
            'organizations.view' => 'all', 'organizations.update' => 'all', 'organizations.delete' => 'all',
            'organization_configs.view' => 'all', 'organization_configs.manage' => 'all', 'organization_configs.approve' => 'all',
            'departments.view' => 'all', 'departments.manage' => 'all', 'departments.view_employees' => 'all',
            'job_titles.view' => 'all', 'job_titles.manage' => 'all',
            'employees.view' => 'all', 'employees.create' => 'all', 'employees.update' => 'all',
            'employees.update_payroll_fields' => 'all', 'employees.update_financial_fields' => 'all', 'employees.delete' => 'all',
            'employees.import' => 'all', 'employees.export' => 'all',
            'leaves.view' => 'all', 'leaves.create' => 'all', 'leaves.update' => 'all', 'leaves.delete' => 'all',
            'leaves.approve' => 'all', 'leaves.cancel' => 'all', 'leaves.assign_reliever' => 'all',
            'leave_types.view' => 'all', 'leave_types.manage' => 'all',
            'attendance.view' => 'all', 'attendance.write' => 'all', 'attendance.check_in_out' => 'own', 'attendance.approve_overtime' => 'all',
            'attendance_deductions.view' => 'all', 'attendance_deductions.waive' => 'all', 'attendance_deductions.reverse' => 'all',
            'allowance_types.view' => 'all', 'allowance_types.manage' => 'all',
            'employee_allowances.view' => 'all', 'employee_allowances.create' => 'all', 'employee_allowances.update' => 'all',
            'employee_allowances.submit' => 'all', 'employee_allowances.approve' => 'all', 'employee_allowances.suspend' => 'all',
            'employee_allowances.cancel' => 'all', 'employee_allowances.attach_payrun' => 'all',
            'payruns.view' => 'all', 'payruns.process' => 'all', 'payruns.finalize' => 'all',
            'payrun_details.view' => 'all',
            'payslips.view' => 'all', 'payslips.generate' => 'all', 'payslips.send' => 'all', 'payslips.bulk_send' => 'all',
            'payslips.update_pdf_path' => 'all', 'payslips.statistics' => 'all',
            'p9.view' => 'all', 'p9.generate' => 'all', 'p9.finalize' => 'all', 'p9.bulk_finalize' => 'all', 'p9.mark_submitted' => 'all',
            'reimbursements.view' => 'all', 'reimbursements.create' => 'all', 'reimbursements.update' => 'all', 'reimbursements.cancel' => 'all',
            'reimbursements.approve_manager' => 'all', 'reimbursements.approve_hr' => 'all', 'reimbursements.approve_finance' => 'all',
            'reimbursements.dispute' => 'all', 'reimbursements.resolve_dispute' => 'all',
            'reimbursements.process_payment' => 'all', 'reimbursements.reverse_payment' => 'all',
            'loans.view' => 'all', 'loans.create' => 'all', 'loans.approve_manager' => 'all', 'loans.approve_hr' => 'all', 'loans.approve_finance' => 'all',
            'loans.disburse' => 'all', 'loans.record_repayment' => 'all', 'loans.review_appeal' => 'all',
            'roles.view' => 'all', 'roles.manage' => 'all', 'permissions.view' => 'all', 'users.manage_roles' => 'all',
        ],

        'hr_manager' => [
            'organizations.view' => 'all', 'organizations.update' => 'all',
            'organization_configs.view' => 'all',
            'departments.view' => 'all', 'departments.manage' => 'all', 'departments.view_employees' => 'all',
            'job_titles.view' => 'all', 'job_titles.manage' => 'all',
            'employees.view' => 'all', 'employees.create' => 'all', 'employees.update' => 'all', 'employees.delete' => 'all',
            'employees.import' => 'all', 'employees.export' => 'all',
            'leaves.view' => 'all', 'leaves.approve' => 'all', 'leaves.cancel' => 'all', 'leave_types.view' => 'all', 'leave_types.manage' => 'all',
            'attendance.view' => 'all', 'attendance.write' => 'all', 'attendance.check_in_out' => 'own',
            'attendance_deductions.view' => 'all', 'attendance_deductions.waive' => 'all', 'attendance_deductions.reverse' => 'all',
            'employee_allowances.view' => 'all', 'employee_allowances.create' => 'all', 'employee_allowances.update' => 'all',
            'employee_allowances.submit' => 'all', 'employee_allowances.suspend' => 'all', 'employee_allowances.cancel' => 'all',
            'payruns.view' => 'all', 'payruns.process' => 'all',
            'payrun_details.view' => 'all',
            'payslips.view' => 'all',
            'p9.view' => 'all',
            'reimbursements.view' => 'all', 'reimbursements.create' => 'all',
            'reimbursements.approve_manager' => 'all', 'reimbursements.approve_hr' => 'all',
            'reimbursements.dispute' => 'all', 'reimbursements.resolve_dispute' => 'all',
            'loans.view' => 'all', 'loans.create' => 'all', 'loans.approve_manager' => 'all', 'loans.approve_hr' => 'all', 'loans.review_appeal' => 'all',
        ],

        'hr_officer' => [
            'departments.view' => 'all', 'job_titles.view' => 'all',
            'employees.view' => 'all',
            'leaves.view' => 'all', 'leaves.cancel' => 'all',
            'payslips.view' => 'department', 'payslips.send' => 'all',
            // No p9.* grant — P9AuthorizationMiddleware's switch has no case
            // for hr_officer, so its default denies them entirely today.
            'attendance.view' => 'all', 'attendance.check_in_out' => 'own',
            'loans.view' => 'team', 'loans.create' => 'all',
        ],

        'payroll_manager' => [
            'organizations.view' => 'all',
            'organization_configs.view' => 'all', 'organization_configs.manage' => 'all', 'organization_configs.approve' => 'all',
            'departments.view' => 'all',
            'job_titles.view' => 'all',
            'employees.view' => 'all', 'employees.update_payroll_fields' => 'all',
            'allowance_types.view' => 'all', 'allowance_types.manage' => 'all',
            'employee_allowances.view' => 'all', 'employee_allowances.create' => 'all', 'employee_allowances.update' => 'all',
            'employee_allowances.submit' => 'all', 'employee_allowances.approve' => 'all', 'employee_allowances.suspend' => 'all',
            'employee_allowances.cancel' => 'all', 'employee_allowances.attach_payrun' => 'all',
            'attendance.view' => 'all', 'attendance.check_in_out' => 'own', 'attendance.approve_overtime' => 'all',
            'attendance_deductions.view' => 'all',
            'payruns.view' => 'all', 'payruns.process' => 'all', 'payruns.finalize' => 'all',
            'payrun_details.view' => 'all',
            'payslips.view' => 'all', 'payslips.generate' => 'all', 'payslips.send' => 'all', 'payslips.bulk_send' => 'all',
            'payslips.update_pdf_path' => 'all',
            'p9.view' => 'all', 'p9.generate' => 'all', 'p9.finalize' => 'all', 'p9.bulk_finalize' => 'all', 'p9.mark_submitted' => 'all',
            'reimbursements.view' => 'all', 'reimbursements.create' => 'all',
            'reimbursements.approve_manager' => 'all', 'reimbursements.approve_hr' => 'all', 'reimbursements.approve_finance' => 'all',
            'reimbursements.process_payment' => 'all',
            'loans.view' => 'all', 'loans.create' => 'all', 'loans.disburse' => 'all', 'loans.record_repayment' => 'all',
        ],

        'payroll_officer' => [
            'organization_configs.view' => 'all',
            'employees.view' => 'all',
            'allowance_types.view' => 'all',
            'employee_allowances.view' => 'all', 'employee_allowances.create' => 'all', 'employee_allowances.update' => 'all',
            'employee_allowances.submit' => 'all', 'employee_allowances.suspend' => 'all', 'employee_allowances.cancel' => 'all',
            'employee_allowances.attach_payrun' => 'all',
            'attendance.view' => 'all', 'attendance.check_in_out' => 'own', 'attendance.approve_overtime' => 'all',
            'payruns.view' => 'all', 'payruns.process' => 'all',
            'payrun_details.view' => 'all',
            'payslips.view' => 'department', 'payslips.generate' => 'all', 'payslips.send' => 'all',
            // P9AuthorizationMiddleware groups payroll_officer with payroll_manager (full access).
            'p9.view' => 'all', 'p9.generate' => 'all', 'p9.finalize' => 'all', 'p9.bulk_finalize' => 'all', 'p9.mark_submitted' => 'all',
            'reimbursements.view' => 'all',
            'loans.view' => 'team', 'loans.record_repayment' => 'all',
        ],

        'finance_manager' => [
            'organizations.view' => 'all', 'organizations.update' => 'all',
            'organization_configs.view' => 'all', 'organization_configs.manage' => 'all', 'organization_configs.approve' => 'all',
            'employees.view' => 'all', 'employees.update_financial_fields' => 'all',
            'employee_allowances.view' => 'all', 'employee_allowances.approve' => 'all',
            'attendance_deductions.view' => 'all',
            'payruns.view' => 'all', 'payruns.finalize' => 'all',
            'payrun_details.view' => 'all',
            'payslips.view' => 'all', 'payslips.statistics' => 'all',
            'p9.view' => 'all',
            'reimbursements.view' => 'all', 'reimbursements.approve_finance' => 'all',
            'reimbursements.process_payment' => 'all', 'reimbursements.reverse_payment' => 'all',
            'loans.view' => 'all', 'loans.approve_finance' => 'all', 'loans.disburse' => 'all', 'loans.record_repayment' => 'all',
        ],

        'auditor' => [
            'organizations.view' => 'all',
            'organization_configs.view' => 'all',
            'departments.view' => 'all', 'job_titles.view' => 'all',
            'employees.view' => 'all',
            'leaves.view' => 'all',
            'attendance.view' => 'all',
            'attendance_deductions.view' => 'all',
            'allowance_types.view' => 'all', 'employee_allowances.view' => 'all',
            'payruns.view' => 'all', 'payrun_details.view' => 'all',
            'payslips.view' => 'all',
            'p9.view' => 'all',
            'reimbursements.view' => 'all',
            'loans.view' => 'all',
        ],

        'department_manager' => [
            'departments.view' => 'own', // their own department only
            'employees.view' => 'team',
            'leaves.view' => 'team', 'leaves.approve' => 'team',
            'attendance.view' => 'team', 'attendance.check_in_out' => 'own',
            'attendance_deductions.view' => 'team',
            'employee_allowances.view' => 'department',
            'payrun_details.view' => 'own',
            'payruns.view' => 'all',
            'payslips.view' => 'team',
            'p9.view' => 'team',
            'reimbursements.view' => 'team', 'reimbursements.approve_manager' => 'team',
            'loans.view' => 'team', 'loans.approve_manager' => 'team',
        ],

        'employee' => [
            'employees.view' => 'own',
            'leaves.view' => 'own', 'leaves.create' => 'own', 'leaves.update' => 'own', 'leaves.cancel' => 'own',
            'leave_types.view' => 'all', // read the catalogue to know what they can apply for
            'attendance.view' => 'own', 'attendance.check_in_out' => 'own',
            'attendance_deductions.view' => 'own',
            'employee_allowances.view' => 'own',
            'payruns.view' => 'all',
            'payslips.view' => 'own',
            'p9.view' => 'own',
            'reimbursements.view' => 'own', 'reimbursements.create' => 'own', 'reimbursements.update' => 'own',
            'reimbursements.cancel' => 'own', 'reimbursements.dispute' => 'own',
            'loans.view' => 'own', 'loans.create' => 'own',
        ],
    ];

    private const ROLE_LABELS = [
        'super_admin'        => 'Super Admin',
        'admin'              => 'Admin',
        'hr_manager'         => 'HR Manager',
        'hr_officer'         => 'HR Officer',
        'payroll_manager'    => 'Payroll Manager',
        'payroll_officer'    => 'Payroll Officer',
        'finance_manager'    => 'Finance Manager',
        'auditor'            => 'Auditor',
        'department_manager' => 'Department Manager',
        'employee'           => 'Employee',
    ];

    /**
     * Seed all 10 default roles + their permission grants for one organization.
     * Idempotent — safe to re-run.
     */
    public static function seedForOrganization(int $organizationId): void
    {
        foreach (self::DEFAULT_MATRIX as $slug => $permissionMap) {
            $roleId = self::findOrCreateRole($organizationId, $slug);
            self::grantPermissions($roleId, $permissionMap);
        }
    }

    private static function findOrCreateRole(int $organizationId, string $slug): int
    {
        $existing = DB::raw(
            "SELECT id FROM roles WHERE organization_id = :org_id AND slug = :slug",
            [':org_id' => $organizationId, ':slug' => $slug]
        );

        if (!empty($existing)) {
            return (int) $existing[0]->id;
        }

        $name = self::ROLE_LABELS[$slug] ?? ucfirst(str_replace('_', ' ', $slug));

        DB::raw(
            "INSERT INTO roles (organization_id, name, slug, is_system, created_at)
             VALUES (:org_id, :name, :slug, 1, NOW())",
            [':org_id' => $organizationId, ':name' => $name, ':slug' => $slug]
        );

        $inserted = DB::raw(
            "SELECT id FROM roles WHERE organization_id = :org_id AND slug = :slug",
            [':org_id' => $organizationId, ':slug' => $slug]
        );

        return (int) $inserted[0]->id;
    }

    private static function grantPermissions(int $roleId, array $permissionMap): void
    {
        foreach ($permissionMap as $permissionName => $scope) {
            $permission = DB::raw(
                "SELECT id FROM permissions WHERE name = :name",
                [':name' => $permissionName]
            );

            if (empty($permission)) {
                error_log("RoleSeederService: unknown permission '{$permissionName}' — skipped");
                continue;
            }

            DB::raw(
                "INSERT IGNORE INTO role_has_permissions (role_id, permission_id, scope, created_at)
                 VALUES (:role_id, :permission_id, :scope, NOW())",
                [
                    ':role_id'       => $roleId,
                    ':permission_id' => $permission[0]->id,
                    ':scope'         => $scope,
                ]
            );
        }
    }
}