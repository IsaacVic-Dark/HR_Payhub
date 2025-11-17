import axios from 'axios';
import { getCookie } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Create main API instance
export const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// Request interceptor to add auth token to all requests
api.interceptors.request.use(
    (config) => {
        const token = getCookie('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        config.headers['Content-Type'] = 'application/json';
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token refresh globally
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = getCookie('refresh_token');
                if (refreshToken) {
                    // Use authAPI to avoid infinite loop
                    const authAPI = axios.create({
                        baseURL: API_BASE_URL,
                        withCredentials: true,
                    });

                    const response = await authAPI.post('/auth/refresh', {
                        refresh_token: refreshToken,
                    });

                    const { access_token, refresh_token } = response.data.tokens;
                    
                    // Update cookies
                    document.cookie = `access_token=${access_token}; path=/; max-age=3600`;
                    document.cookie = `refresh_token=${refresh_token}; path=/; max-age=604800`;

                    // Retry original request
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // If refresh fails, redirect to login
                document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Export API methods for different resources
export const apiService = {
    // Organizations
    organizations: {
        getAll: () => api.get('/organizations'),
        getById: (id) => api.get(`/organizations/${id}`),
        create: (data) => api.post('/organizations', data),
        update: (id, data) => api.put(`/organizations/${id}`, data),
        delete: (id) => api.delete(`/organizations/${id}`),
    },

    // Employees
    employees: {
        getAll: (organizationId) => api.get(`/organizations/${organizationId}/employees`),
        getById: (organizationId, id) => api.get(`/organizations/${organizationId}/employees/${id}`),
        create: (organizationId, data) => api.post(`/organizations/${organizationId}/employees`, data),
        update: (organizationId, id, data) => api.put(`/organizations/${organizationId}/employees/${id}`, data),
        delete: (organizationId, id) => api.delete(`/organizations/${organizationId}/employees/${id}`),
    },

    // Leaves
    leaves: {
        getAll: () => api.get('/organizations/leaves'),
        getStatistics: () => api.get('/organizations/leaves/statistics'),
        getById: (id) => api.get(`/organizations/leaves/${id}`),
        create: (data) => api.post('/organizations/leaves', data),
        update: (id, data) => api.put(`/organizations/leaves/${id}`, data),
        approve: (id) => api.post(`/organizations/leaves/${id}/approve`),
        reject: (id) => api.post(`/organizations/leaves/${id}/reject`),
        delete: (id) => api.delete(`/organizations/leaves/${id}`),
    },

    // Payruns
    payruns: {
        getAll: (organizationId) => api.get(`/organizations/${organizationId}/payruns`),
        getById: (organizationId, id) => api.get(`/organizations/${organizationId}/payruns/${id}`),
        create: (organizationId, data) => api.post(`/organizations/${organizationId}/payruns`, data),
        update: (organizationId, id, data) => api.put(`/organizations/${organizationId}/payruns/${id}`, data),
        delete: (organizationId, id) => api.delete(`/organizations/${organizationId}/payruns/${id}`),
    },
};

export default api;