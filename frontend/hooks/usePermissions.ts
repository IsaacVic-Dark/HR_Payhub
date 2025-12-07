import { useAuth } from './useAuth';
import { canAccessPage, getAccessiblePages, hasAnyRole } from '@/utils/permissions';

export function usePermissions() {
  const { user, hasRole } = useAuth();

  const userRole = user?.user_type || null;

  console.log('User Role in usePermissions:', userRole);

  const permissions = {
    // Core permission checker
    canAccessPage: (path: string) => canAccessPage(userRole, path),
    getAccessiblePages: () => getAccessiblePages(userRole),
    
    // Super Admin can do everything
    canViewEverything: hasRole(['super_admin']),
    
    // Organization Management
    canManageOrganization: hasRole(['super_admin']),
    canViewOrganization: hasRole(['super_admin']),
    
    // Employee Management
    canManageEmployees: hasRole(['super_admin', 'admin', 'hr_manager']),
    canViewEmployees: hasRole(['super_admin', 'admin', 'hr_manager', 'payroll_manager', 'department_manager']),
    
    // Payroll Management
    canManagePayroll: hasRole(['super_admin', 'admin', 'payroll_manager']),
    canViewPayroll: hasRole(['super_admin', 'admin', 'payroll_manager', 'payroll_officer', 'finance_manager']),
    canProcessPayments: hasRole(['super_admin', 'finance_manager']),
    
    // Leaves Management
    canManageLeaves: hasRole(['super_admin', 'admin', 'hr_manager', 'department_manager']),
    canViewLeaves: hasRole(['super_admin', 'admin', 'hr_manager', 'department_manager', 'employee']),
    
    // Settings & Configuration
    canManageSettings: hasRole(['super_admin', 'admin']),
    
    // Reports & Analytics
    canViewReports: hasRole(['super_admin', 'admin', 'hr_manager', 'payroll_manager', 'finance_manager', 'auditor']),
    canViewAuditLogs: hasRole(['super_admin', 'admin', 'auditor']),
    
    // User specific
    isSuperAdmin: hasRole(['super_admin']),
    isAdmin: hasRole(['admin']),
    isHRManager: hasRole(['hr_manager']),
    isPayrollManager: hasRole(['payroll_manager']),
    isPayrollOfficer: hasRole(['payroll_officer']),
    isDepartmentManager: hasRole(['department_manager']),
    isFinanceManager: hasRole(['finance_manager']),
    isAuditor: hasRole(['auditor']),
    isEmployee: hasRole(['employee']),
    
    // Current user info
    currentUser: user,
    userRole: userRole
  };

  return { ...permissions, hasRole };
}