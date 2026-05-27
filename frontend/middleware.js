import { NextResponse } from 'next/server'

/**
 * middleware.js
 *
 * Guards:
 *  1. Unauthenticated users trying to access protected routes → /login
 *  2. Authenticated users with setup_completed = 0 → /setup  (except /setup and /api/*)
 *  3. Authenticated users with setup_completed = 1 visiting /setup → /dashboard
 *
 * JWT payload shape (nested under `data`):
 *   { user_id, organization_id, user_type, setup_completed, subscription_status }
 *
 * The access_token is an httpOnly cookie set by the PHP backend.
 * We decode the payload client-side (no signature verification here —
 * that is enforced by AuthMiddleware on every PHP API call).
 */

// ─── Route tables ─────────────────────────────────────────────────────────────

const protectedRoutes = [
  { path: '/dashboard',    roles: ['employee', 'admin', 'super_admin'] },
  { path: '/employees',    roles: ['admin', 'super_admin'] },
  { path: '/organization', roles: ['admin', 'super_admin'] },
  { path: '/payrun',       roles: ['admin', 'super_admin'] },
  { path: '/payments',     roles: ['admin', 'super_admin'] },
  { path: '/leaves',       roles: ['employee', 'admin', 'super_admin'] },
  { path: '/setup',        roles: ['admin'] },
]

const publicRoutes = ['/login', '/register', '/']

// ─── JWT decode helper (payload only — no verification) ──────────────────────

/**
 * Decode the JWT payload without verifying the signature.
 * Signature verification happens server-side on every API call.
 * Returns null if the token is missing or malformed.
 */
function decodeJwtPayload(token) {
  try {
    const base64Payload = token.split('.')[1]
    if (!base64Payload) return null

    // atob is available in the Edge runtime
    const jsonStr = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request) {
  const { pathname } = request.nextUrl
  const accessToken  = request.cookies.get('access_token')?.value

  // ── 1. Always allow public routes ──────────────────────────────────────────
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  // ── 2. Decode JWT (payload only) ───────────────────────────────────────────
  const jwtPayload   = accessToken ? decodeJwtPayload(accessToken) : null
  const jwtData      = jwtPayload?.data ?? null   // our payload is nested under 'data'
  const isAuthed     = !!jwtData

  // setup_completed comes from the JWT data object
  const setupCompleted      = isAuthed ? Number(jwtData.setup_completed)      : null
  const subscriptionStatus  = isAuthed ? String(jwtData.subscription_status ?? '') : null

  // ── 3. Unauthenticated → redirect to login ─────────────────────────────────
  const isProtected = protectedRoutes.some(
    r => pathname === r.path || pathname.startsWith(r.path + '/')
  )

  if (isProtected && !isAuthed) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 4. Setup guards (only for authenticated users) ─────────────────────────
  if (isAuthed) {
    const isApiRoute   = pathname.startsWith('/api/')
    const isSetupRoute = pathname === '/setup' || pathname.startsWith('/setup/')

    // 4a. setup not done + not already on /setup (and not an API call) → /setup
    // if (setupCompleted === 0 && !isSetupRoute && !isApiRoute) {
    //   return NextResponse.redirect(new URL('/setup', request.url))
    // }

    // 4b. setup already done + visiting /setup → /dashboard
    if (setupCompleted === 1 && isSetupRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public-folder assets (svg, png, jpg, jpeg, gif, webp)
     *
     * We intentionally include /api/* so that the JWT guards run
     * on Next.js API routes too (plain PHP routes are excluded by
     * virtue of being on a different origin / handled by Apache/Nginx).
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}