'use client'

import { useAuth } from '@/hooks/useAuth'

interface ProtectedLayoutProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

export default function ProtectedLayout({ children, requiredRoles = [] }: ProtectedLayoutProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth()

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Hide completely if not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Hide completely if user doesn't have required roles
  if (requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    return null
  }

  return <>{children}</>
}