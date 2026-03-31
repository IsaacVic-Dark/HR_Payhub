<?php
class PermissionsService
{
    private static array $pagePermissions = [
        'super_admin'       => [
            "/dashboard",
            "/organizations",
            "/organizations/create",
            "/organizations/:id/edit",
            "/organizations/:id/settings",
            "/system-settings",
            "/system-integrations",
            "/global-configurations",
            "/audit-logs/system",
            "/super-admins",
            "/super-admins/create",
            "/all-organizations-data",
            "/system-reports",
            "/backup-restore"
        ],

        'admin'             => [
            "/dashboard",
            "/company-profile",
            "/company-settings",
            "/departments",
            "/departments/create",
            "/departments/:id/edit",
            "/cost-centers",
            "/salary-structures",
            "/salary-structures/create",
            "/salary-grades",
            "/job-groups",
            "/positions",
            "/payroll-cycles",
            "/payroll-calendars",
            "/holidays",
            "/work-schedules",
            "/users",
            "/users/create",
            "/users/:id/edit",
            "/roles-permissions",
            "/allowances",
            "/allowances/create",
            "/deductions",
            "/deductions/create",
            "/statutory-contributions",
            "/payroll-formulas",
            "/bank-accounts",
            "/payment-methods",
            "/approval-workflows",
            "/reports",
            "/audit-logs",
            "/data-export"
        ],

        'hr_manager'        => [
            "/dashboard",
            "/employees",
            "/employees/create",
            "/employees/list",
            "/employees/:id/view",
            "/employees/:id/edit",
            "/employees/:id/documents",
            "/employees/:id/contracts",
            "/employees/:id/termination",
            "/employees/:id/bank-details",
            "/employees/departments",
            "/onboarding",
            "/offboarding",
            "/employee-salaries",
            "/salary-adjustments",
            "/salary-increments",
            "/employee-allowances",
            "/employee-deductions",
            "/benefits",
            "/benefits-enrollment",
            "/leave-policies",
            "/leaves",
            "/leave-requests",
            "/leave-approvals",
            "/leave-balances",
            "/leave-encashment",
            "/attendance",
            "/time-off-policies",
            "/performance-reviews",
            "/training",
            "/career-progression",
            "/hr-reports",
            "/hr-analytics",
            "/headcount-reports",
            "/turnover-reports",
            "/employee-export"
        ],

        'payroll_manager'   => [
            "/dashboard",
            "/payroll",
            "/payrun",
            "/payrun/active",
            "/payrun/history",
            "/payroll/run",
            "/payroll/calculate",
            "/payroll/review",
            "/payroll/approve",
            "/payroll/history",
            "/payroll/adjustments",
            "/payroll/mid-month",
            "/payroll/recalculate",
            "/statutory-contributions/process",
            "/payslips",
            "/payslips/generate",
            "/payslips/distribute",
            "/bonuses",
            "/commissions",
            "/one-time-payments",
            "/termination-payments",
            "/back-pay",
            "/arrears",
            "/advances",
            "/loan-deductions",
            "/payroll-reports",
            "/statutory-reports",
            "/tax-reports",
            "/tax-filings",
            "/p9-forms",
            "/pension-reports",
            "/payroll-export",
            "/employees/:id/view",
            "/employees/:id/salary",
            "/leave-balances/view"
        ],

        'payroll_officer'   => [
            "/dashboard",
            "/payroll/data-entry",
            "/payroll/inputs",
            "/overtime-entry",
            "/allowances-entry",
            "/deductions-entry",
            "/attendance-entry",
            "/bulk-upload",
            "/payroll/validate",
            "/payroll/draft",
            "/payroll/status",
            "/payroll-history/view",
            "/payroll-reports/view",
            "/employees/:id/view",
            "/documentation"
        ],

        'department_manager'=> [
            "/dashboard",
            "/team",
            "/team/leave-requests",
            "/team/leave-calendar",
            "/team/leave-approvals",
            "/team/overtime-requests",
            "/team/overtime-approvals",
            "/team/shift-approvals",
            "/team/attendance",
            "/team/allowances-approvals",
            "/team/expense-claims",
            "/team/travel-allowances",
            "/team/members",
            "/team/salary-adjustment-requests",
            "/team/performance-input",
            "/department-reports",
            "/team-cost-reports",
            "/team-attendance-reports",
            "/leaves"
        ],

        'finance_manager'   => [
            "/dashboard",
            "/payments",
            "/payments/records",
            "/payments/pending",
            "/payments/review",
            "/payments/generate-files",
            "/payments/bank-upload",
            "/payments/process",
            "/payments/exceptions",
            "/payment-vouchers",
            "/statutory-payments",
            "/tax-remittances",
            "/pension-remittances",
            "/insurance-payments",
            "/statutory-filing",
            "/financial-reports",
            "/payroll-costs",
            "/journal-entries",
            "/payment-status",
            "/reconciliation",
            "/bank-statements",
            "/payment-approvals",
            "/bank-accounts/verify",
            "/payment-batches",
            "/fund-transfers",
            "/payment-audit-trails",
            "/compliance-reports"
        ],

        'auditor'           => [
            "/dashboard",
            "/audit/payroll-records",
            "/audit/historical-data",
            "/audit/calculation-logs",
            "/audit/payment-history",
            "/audit/compensation-records",
            "/audit/audit-trails",
            "/audit/user-activity",
            "/audit/statutory-compliance",
            "/audit/tax-calculations",
            "/audit/pension-contributions",
            "/audit/formulas",
            "/audit/workflows",
            "/audit/configurations",
            "/audit/reports",
            "/audit/analytics",
            "/audit/export",
            "/audit/dashboards",
            "/audit/year-end",
            "/audit/exceptions",
            "/audit/anomalies",
            "/audit/violations"
        ],

        'employee'          => [
            "/dashboard",
            "/my-payslips",
            "/my-payslips/:id/download",
            "/my-salary",
            "/my-deductions",
            "/my-allowances",
            "/my-tax-info",
            "/my-loans",
            "/my-ytd-earnings",
            "/my-profile",
            "/my-profile/edit-request",
            "/my-contact/update",
            "/my-bank-details/update",
            "/my-contract",
            "/myleave",
            "/myleave/apply",
            "/myleave/balance",
            "/myleave/history",
            "/myleave/cancel",
            "/leave-policy",
            "/my-attendance",
            "/my-shifts",
            "/overtime-request",
            "/clock-in-out",
            "/my-requests",
            "/allowance-request",
            "/expense-claim",
            "/salary-advance-request",
            "/my-documents",
            "/tax-certificates",
            "/employment-documents",
            "/document-upload",
            "/help"
        ],
    ];

    private static array $actionPermissions = [
        'admin'             => ['canManageSettings', 'canViewReports', ...],
        'hr_manager'        => ['canManageEmployees', 'canManageLeaves', ...],
        'payroll_manager'   => ['canManagePayroll', 'canReviewPayrun', ...],
        // etc.
    ];

    public static function getPagesForRole(string $role): array
    {
        return self::$pagePermissions[$role] ?? [];
    }

    public static function getActionsForRole(string $role): array
    {
        return self::$actionPermissions[$role] ?? [];
    }

    public static function canAccessPage(string $role, string $path): bool
    {
        $pages = self::getPagesForRole($role);
        foreach ($pages as $pattern) {
            // Convert :id patterns to regex
            $regex = preg_replace('/:[^\/]+/', '[^/]+', $pattern);
            if (preg_match('#^' . $regex . '$#', $path)) {
                return true;
            }
        }
        return false;
    }
}