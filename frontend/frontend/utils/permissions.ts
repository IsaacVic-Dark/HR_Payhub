import permissionsData from '@/config/permissions.json';

/**
 * Check if a user role has access to a specific page
 */
export function canAccessPage(userRole: string | null, pagePath: string): boolean {
  if (!userRole) return false;

  const roleConfig = permissionsData.roles.find(role => role.name === userRole);
  if (!roleConfig) return false;

  // Check exact match
  if (roleConfig.pages.includes(pagePath)) return true;

  // Check dynamic routes (e.g., /employees/:id/view matches /employees/123/view)
  return roleConfig.pages.some(allowedPath => {
    if (!allowedPath.includes(':')) return false;
    
    const allowedPathRegex = new RegExp(
      '^' + allowedPath.replace(/:[^/]+/g, '[^/]+') + '$'
    );
    return allowedPathRegex.test(pagePath);
  });
}

/**
 * Get all accessible pages for a user role
 */
export function getAccessiblePages(userRole: string | null): string[] {
  if (!userRole) return [];

  const roleConfig = permissionsData.roles.find(role => role.name === userRole);
  return roleConfig?.pages || [];
}

/**
 * Check if user has any of the required roles
 */
export function hasAnyRole(userRole: string | null, requiredRoles: string[]): boolean {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
}

/**
 * Filter navigation items based on user permissions
 */
export function filterNavByPermissions(
  navItems: any[], 
  userRole: string | null
): any[] {
  if (!userRole) return [];

  return navItems.filter(item => {
    // Check if user can access the main item
    const hasAccess = item.roles ? hasAnyRole(userRole, item.roles) : canAccessPage(userRole, item.url);
    
    if (!hasAccess) return false;

    // If item has dropdown, filter sub-items
    if (item.hasDropdown && item.items) {
      item.items = item.items.filter((subItem: any) => 
        canAccessPage(userRole, subItem.url)
      );
      
      // Only show parent if it has accessible sub-items
      return item.items.length > 0;
    }

    return true;
  });
}