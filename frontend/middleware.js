import { NextResponse } from 'next/server'

// Define protected routes and their required roles
const protectedRoutes = [
  { path: '/dashboard', roles: ['employee', 'admin', 'super_admin'] },
  { path: '/employees', roles: ['admin', 'super_admin'] },
  { path: '/organization', roles: ['admin', 'super_admin'] },
  { path: '/payrun', roles: ['admin', 'super_admin'] },
  { path: '/payments', roles: ['admin', 'super_admin'] },
  { path: '/leaves', roles: ['employee', 'admin', 'super_admin'] },
]

const publicRoutes = ['/login', '/register', '/']

export function middleware(request) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('access_token')?.value

  // Check if route is public
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  // Check if route is protected
  const protectedRoute = protectedRoutes.find(route => 
    pathname === route.path || pathname.startsWith(route.path + '/')
  )

  if (protectedRoute) {
    // If no token, redirect to login
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}