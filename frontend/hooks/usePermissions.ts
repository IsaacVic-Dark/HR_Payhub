// hooks/usePermissions.ts - Updated version
import { useAuth } from '@/lib/AuthContext';  // Changed import
import { canAccessPage, getAccessiblePages, hasAnyRole } from '@/utils/permissions';

export function usePermissions() {
  const { user } = useAuth();  // Now using AuthContext

  const userRole = user?.user_type || null;

  const permissions = {
    // Core permission checker
    canAccessPage: (path: string) => canAccessPage(userRole, path),
    getAccessiblePages: () => getAccessiblePages(userRole),
    
    // Super Admin can do everything
    canViewEverything: userRole === 'super_admin',
    
    // Organization Management
    canManageOrganization: userRole === 'super_admin',
    canViewOrganization: userRole === 'super_admin',
    
    // Employee Management
    canManageEmployees: ['super_admin', 'admin', 'hr_manager'].includes(userRole || ''),
    canViewEmployees: ['super_admin', 'admin', 'hr_manager', 'payroll_manager', 'department_manager'].includes(userRole || ''),
    
    // Payroll Management
    canManagePayroll: ['super_admin', 'admin', 'payroll_manager'].includes(userRole || ''),
    canViewPayroll: ['super_admin', 'admin', 'payroll_manager', 'payroll_officer', 'finance_manager'].includes(userRole || ''),
    canProcessPayments: ['super_admin', 'finance_manager'].includes(userRole || ''),
    
    // Leaves Management
    canManageLeaves: ['super_admin', 'admin', 'hr_manager', 'department_manager'].includes(userRole || ''),
    canViewLeaves: ['super_admin', 'admin', 'hr_manager', 'department_manager', 'employee'].includes(userRole || ''),
    
    // Settings & Configuration
    canManageSettings: ['super_admin', 'admin'].includes(userRole || ''),
    
    // Reports & Analytics
    canViewReports: ['super_admin', 'admin', 'hr_manager', 'payroll_manager', 'finance_manager', 'auditor'].includes(userRole || ''),
    canViewAuditLogs: ['super_admin', 'admin', 'auditor'].includes(userRole || ''),
    
    // User specific
    isSuperAdmin: userRole === 'super_admin',
    isAdmin: userRole === 'admin',
    isHRManager: userRole === 'hr_manager',
    isPayrollManager: userRole === 'payroll_manager',
    isPayrollOfficer: userRole === 'payroll_officer',
    isDepartmentManager: userRole === 'department_manager',
    isFinanceManager: userRole === 'finance_manager',
    isAuditor: userRole === 'auditor',
    isEmployee: userRole === 'employee',
    
    // Current user info
    currentUser: user,
    userRole: userRole,
    
    // Add hasRole function for compatibility
    hasRole: (requiredRoles: string | string[]) => {
      if (!userRole) return false;
      if (Array.isArray(requiredRoles)) {
        return requiredRoles.includes(userRole);
      }
      return userRole === requiredRoles;
    }
  };

  return permissions;
}