import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';

export type PermissionScope = 'own' | 'team' | 'department' | 'all';

export function usePermissions() {
  const { user } = useAuth();
  const userRole = user?.role ?? null; // was user?.user_type

  const permMap = useMemo(() => {
    const map = new Map<string, PermissionScope>();
    (user?.permissions ?? []).forEach(p => map.set(p.name, p.scope));
    return map;
  }, [user?.permissions]);

  const hasPermission = (name: string) => permMap.has(name);
  const hasAnyPermission = (names: string[]) => names.some(hasPermission);
  const hasAllPermissions = (names: string[]) => names.every(hasPermission);
  const scopeOf = (name: string): PermissionScope | null => permMap.get(name) ?? null;

  const permissions = {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    scopeOf,

    // Organization Management
    canManageOrganization: hasPermission('organizations.update'),
    canViewOrganization: hasPermission('organizations.view'),

    // Employee Management
    canManageEmployees: hasAnyPermission(['employees.create', 'employees.update', 'employees.delete']),
    canViewEmployees: hasPermission('employees.view'),

    // Payroll Management
    canManagePayroll: hasAnyPermission(['payruns.process', 'payruns.finalize']),
    canViewPayroll: hasPermission('payruns.view'),
    canProcessPayments: hasAnyPermission(['reimbursements.process_payment', 'loans.disburse']),

    // Leaves Management
    canManageLeaves: hasAnyPermission(['leaves.update', 'leaves.approve', 'leave_types.manage']),
    canViewLeaves: hasPermission('leaves.view'),

    // Payrun lifecycle
    canReviewPayrun: hasPermission('payruns.process'),
    canFinalizePayrun: hasPermission('payruns.finalize'),
    // TODO: no backend permission exists for "reopen" yet — using payruns.process
    // as a placeholder. Confirm with backend whether this should be its own
    // permission (e.g. payruns.reopen) before shipping.
    canReopenPayrun: hasPermission('payruns.process'),
    canManageOvertimeApprovals: hasPermission('attendance.approve_overtime'),

    // Settings & Configuration
    canManageSettings: hasPermission('organization_configs.manage'),

    // Reports & Analytics
    // TODO: no reports.* / audit_logs.* permissions exist in the catalog yet.
    // Falling back to role-slug checks until those are added server-side.
    canViewReports: ['super_admin', 'admin', 'hr_manager', 'payroll_manager', 'finance_manager', 'auditor'].includes(userRole || ''),
    canViewAuditLogs: ['super_admin', 'admin', 'auditor'].includes(userRole || ''),

    // Role/identity checks (not permissions — these ask "which role slug am I")
    // TODO: 'super_admin' isn't a seeded role in role_has_permissions/roles —
    // confirm how platform-level accounts are represented before relying on this.
    isSuperAdmin: userRole === 'super_admin',
    isAdmin: userRole === 'admin',
    isHRManager: userRole === 'hr_manager',
    isPayrollManager: userRole === 'payroll_manager',
    isPayrollOfficer: userRole === 'payroll_officer',
    isDepartmentManager: userRole === 'department_manager',
    isFinanceManager: userRole === 'finance_manager',
    isAuditor: userRole === 'auditor',
    isEmployee: userRole === 'employee',

    currentUser: user,
    userRole,

    hasRole: (requiredRoles: string | string[]) => {
      if (!userRole) return false;
      return Array.isArray(requiredRoles) ? requiredRoles.includes(userRole) : userRole === requiredRoles;
    },
  };

  return permissions;
}