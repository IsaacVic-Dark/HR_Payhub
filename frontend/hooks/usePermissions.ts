import { useAuth } from './useAuth'

export function usePermissions() {
  const { user, hasRole } = useAuth()

  const permissions = {
    // Super Admin can do everything
    canViewEverything: hasRole(['super_admin']),
    
    // Organization Management
    canManageOrganization: hasRole(['super_admin']), // Only super_admin
    canViewOrganization: hasRole(['super_admin']), // Only super_admin
    
    // Employee Management
    canManageEmployees: hasRole(['super_admin', 'admin']),
    canViewEmployees: hasRole(['super_admin', 'admin', 'employee']),
    
    // Payroll Management
    canManagePayroll: hasRole(['super_admin', 'admin']),
    canViewPayroll: hasRole(['super_admin', 'admin', 'employee']),
    
    // Leaves Management
    canManageLeaves: hasRole(['super_admin', 'admin']),
    canViewLeaves: hasRole(['super_admin', 'admin', 'employee']),
    
    // Settings & Configuration
    canManageSettings: hasRole(['super_admin']),
    
    // Reports & Analytics
    canViewReports: hasRole(['super_admin', 'admin']),
    
    // User specific
    isSuperAdmin: hasRole(['super_admin']),
    isAdmin: hasRole(['admin']),
    isEmployee: hasRole(['employee']),
    
    // Current user info
    currentUser: user
  }

  return { ...permissions, hasRole }
}