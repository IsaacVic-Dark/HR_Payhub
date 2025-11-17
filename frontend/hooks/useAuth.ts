import { create } from 'zustand';
import { authService } from '@/services/api/auth';

interface User {
    id: number;
    email: string;
    first_name: string;
    surname: string;
    user_type: string;
    organization_id: number;
}

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (credentials: any) => Promise<any>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<boolean>;
    refreshUser: () => Promise<User | null>;
    hasRole: (requiredRoles: string | string[]) => boolean;
    getUserName: () => string;
    getUserInitials: () => string;
    getOrganizationId: () => number | null;
    getUserType: () => string | null;
}

export const useAuth = create<AuthState>((set, get) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    login: async (credentials) => {
        try {
            const data = await authService.login(credentials);
            console.log('Login data:', data); // Debug log

            if (data.success && data.user) {
                set({ user: data.user, isAuthenticated: true });
                return { success: true, data };
            } else {
                return {
                    success: false,
                    error: data.error || 'Login failed'
                };
            }
        } catch (error: any) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Login failed'
            };
        }
    },

    register: async (userData) => {
        try {
            const data = await authService.register(userData);
            if (data.user && data.tokens) {
                set({ user: data.user, isAuthenticated: true });
            }
            return { success: true, data };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error || 'Registration failed'
            };
        }
    },

    registerEmployee: async (employeeData) => {
        try {
            const data = await authService.registerEmployee(employeeData);
            return { success: true, data };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error || 'Employee registration failed'
            };
        }
    },

    logout: async () => {
        try {
            await authService.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            set({ user: null, isAuthenticated: false });
        }
    },

    checkAuth: async () => {
        try {
            const data = await authService.getCurrentUser();
            console.log('Current user response:', data);

            if (data.success && data.user) {
                set({ user: data.user, isAuthenticated: true, isLoading: false });
                return true;
            } else {
                console.log('No user logged in - this is normal for first visit');
                set({ user: null, isAuthenticated: false, isLoading: false });
                return false;
            }
        } catch (error) {
            console.log('Auth check failed - user not authenticated');
            set({ user: null, isAuthenticated: false, isLoading: false });
            return false;
        }
    },

    refreshUser: async () => {
        try {
            const data = await authService.getCurrentUser();
            set({ user: data.user });
            return data.user;
        } catch (error) {
            console.error('Failed to refresh user data:', error);
            return null;
        }
    },

    hasRole: (requiredRoles) => {
        const { user } = get();

        // If no user or no user_type, check if they should be treated as employee
        if (!user || !user.user_type) {
            // Check if the required role is specifically for employee
            if (Array.isArray(requiredRoles)) {
                return requiredRoles.includes('employee');
            }
            return requiredRoles === 'employee';
        }

        // Normal role checking for users with a user_type
        if (Array.isArray(requiredRoles)) {
            return requiredRoles.includes(user.user_type);
        }

        return user.user_type === requiredRoles;
    },

    getUserName: () => {
        const { user } = get();
        if (!user) return '';

        if (user.first_name && user.surname) {
            return `${user.first_name} ${user.surname}`;
        }

        return user.email || '';
    },

    getUserInitials: () => {
        const { user } = get();
        if (!user) return 'U';

        if (user.first_name && user.surname) {
            return `${user.first_name[0]}${user.surname[0]}`.toUpperCase();
        }

        return user.email ? user.email[0].toUpperCase() : 'U';
    },

    getOrganizationId: () => {
        const { user } = get();
        return user?.organization_id || null;
    },

    getUserType: () => {
        const { user } = get();
        return user?.user_type || null;
    }
}));

// Initialize auth state on app load
// Initialize auth state on app load - but only if we're in browser
if (typeof window !== 'undefined') {
    // Use setTimeout to avoid interfering with initial render
    setTimeout(() => {
        useAuth.getState().checkAuth();
    }, 0);
}

export { usePermissions } from './usePermissions';