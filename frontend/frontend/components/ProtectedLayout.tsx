'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  /**
   * If true, hides content instead of redirecting when user lacks required roles.
   * Useful for nested conditional content within a page.
   */
  hideOnUnauthorized?: boolean;
}

export default function ProtectedLayout({ 
  children, 
  requiredRoles,
  hideOnUnauthorized = false 
}: ProtectedLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect once to prevent multiple redirects
    if (hasRedirected.current) return;

    if (!isLoading && !user) {
      hasRedirected.current = true;
      router.push('/login');
      return;
    }

    // Check role authorization
    if (user && requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.includes(user.user_type);
      
      console.log("ProtectedLayout check:", {
        requiredRoles,
        userType: user.user_type,
        hasRequiredRole,
        hideOnUnauthorized
      });

      if (!hasRequiredRole && !hideOnUnauthorized) {
        hasRedirected.current = true;
        router.push('/unauthorized');
      }
    }
  }, [user, isLoading, router, requiredRoles, hideOnUnauthorized]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // Check role authorization
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.includes(user.user_type);
    
    if (!hasRequiredRole) {
      // If hideOnUnauthorized is true, just don't render the children
      if (hideOnUnauthorized) {
        return null;
      }
      // Otherwise, the redirect will happen in useEffect
      return null;
    }
  }

  return <>{children}</>;
}