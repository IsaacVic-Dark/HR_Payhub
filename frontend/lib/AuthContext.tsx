'use client';

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/api/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobTitle {
  id: number;
  title: string;
}

interface Employee {
  id: number;
  firstname: string;
  middlename: string | null;
  surname: string;
  personalemail: string;
  job_title: JobTitle;
  status: 'active' | 'inactive';
}

interface User {
  id: number;
  email: string;
  username: string;
  user_type: string;
  organization_id: number;
  employee: Employee | null;
  setup_completed: number;
  subscription_status: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  isLoading: boolean;
  checkAuthStatus: () => Promise<void>;
  markSetupComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

// ─── JWT payload decoder (no verification — mirrors middleware.js) ─────────────

function decodeJwtData(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return (payload?.data as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/**
 * Read the access_token cookie value from document.cookie.
 * Returns null in SSR / when no cookie is present.
 */
function getAccessTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps { children: ReactNode }

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // ── Hydrate from localStorage on mount ────────────────────────────────────
useEffect(() => {
  // Don't attempt auth check on public pages — prevents refresh loop on /login
  // and prevents authed-only calls firing (and redirecting) on public marketing/docs pages.
  const publicPaths = ['/login', '/register', '/', '/landing', '/docs', '/unauthorized'];
  const isPublicPath = publicPaths.some(
    (path) => window.location.pathname === path || window.location.pathname.startsWith(path + '/')
  );
  if (isPublicPath) {
    setIsLoading(false);   // unblock the UI
    return;
  }

  const saved = localStorage.getItem('auth_user');
  if (saved) {
    try { setUser(JSON.parse(saved)); } catch { localStorage.removeItem('auth_user'); }
  }
  checkAuthStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // ── Persist to localStorage whenever user changes ─────────────────────────
  useEffect(() => {
    if (user) localStorage.setItem('auth_user', JSON.stringify(user));
    else localStorage.removeItem('auth_user');
  }, [user]);

  // ── checkAuthStatus ────────────────────────────────────────────────────────
  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authService.getCurrentUser();

      if (response.success && response.user) {
        // Merge setup_completed + subscription_status from JWT if the /me
        // endpoint doesn't return them directly yet.
        const merged = mergeJwtClaims(response.user);
        setUser(merged);
        return;
      }

      setUser(null);
      localStorage.removeItem('auth_user');
    } catch {
      setUser(null);
      localStorage.removeItem('auth_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    setIsLoading(true);
    try {
      const response = await authService.login({ email, password });
      if (!response.success) { setIsLoading(false); return null; }

      const userResponse = await authService.getCurrentUser();

      if (userResponse.success && userResponse.user) {
        const merged = mergeJwtClaims(userResponse.user);
        setUser(merged);
        setIsLoading(false);
        return merged;
      }

      setIsLoading(false);
      return null;
    } catch {
      setIsLoading(false);
      return null;
    }
  }, []);

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    finally {
      setUser(null);
      localStorage.removeItem('auth_user');
      router.push('/login');
    }
  }, [router]);

  // ── markSetupComplete ──────────────────────────────────────────────────────
  /**
   * Called by the setup wizard after a successful POST /organization/complete-setup.
   * Updates the in-memory user object without requiring a full token refresh,
   * so middleware.js stops redirecting to /setup on the very next navigation.
   */
  const markSetupComplete = useCallback(() => {
    setUser(u => u ? { ...u, setup_completed: 1 } : u);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────
  const value: AuthContextType = {
    user, login, logout, isLoading, checkAuthStatus, markSetupComplete,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge setup_completed and subscription_status from the JWT cookie into the
 * user object returned by the /me endpoint.
 *
 * This lets the frontend work correctly even before the /me endpoint is updated
 * to return these fields directly.
 */
function mergeJwtClaims(apiUser: Partial<User>): User {
  const token = getAccessTokenFromCookie();
  const jwtData = token ? decodeJwtData(token) : null;

  return {
    ...(apiUser as User),
    setup_completed: (apiUser.setup_completed ?? Number(jwtData?.setup_completed ?? 0)),
    subscription_status: (apiUser.subscription_status ?? String(jwtData?.subscription_status ?? '')),
  };
}