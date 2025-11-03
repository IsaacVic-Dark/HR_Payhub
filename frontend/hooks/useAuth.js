import { create } from 'zustand';
import { authService } from '@/services/api/auth';

export const useAuth = create((set, get) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    login: async (credentials) => {
        try {
            const data = await authService.login(credentials);
            set({ user: data.user, isAuthenticated: true });
            return { success: true, data };
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
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
            const { user } = await authService.getCurrentUser();
            set({ user, isAuthenticated: true, isLoading: false });
            return true;
        } catch (error) {
            set({ user: null, isAuthenticated: false, isLoading: false });
            return false;
        }
    },

    hasRole: (requiredRoles) => {
        const { user } = get();
        if (!user || !user.user_type) return false;

        if (Array.isArray(requiredRoles)) {
            return requiredRoles.includes(user.user_type);
        }

        return user.user_type === requiredRoles;
    },
}));

// Initialize auth state on app load
if (typeof window !== 'undefined') {
    useAuth.getState().checkAuth();
}