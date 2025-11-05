import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const authAPI = axios.create({
    baseURL: `${API_BASE_URL}`, // ✅ FIXED: Remove /auth/login from base URL
    withCredentials: true,
});

// Request interceptor to add auth token
authAPI.interceptors.request.use(
    (config) => {
        const token = getCookie('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token refresh
authAPI.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = getCookie('refresh_token');
                if (refreshToken) {
                    const response = await authAPI.post('/auth/refresh', { // ✅ FIXED: Correct endpoint
                        refresh_token: refreshToken,
                    });

                    const { access_token, refresh_token } = response.data.tokens;
                    setAuthCookies(access_token, refresh_token);

                    // Retry original request
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return axios(originalRequest);
                }
            } catch (refreshError) {
                // If refresh fails, logout user
                clearAuthCookies();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export const authService = {
    async login(credentials) {
        const response = await authAPI.post('/auth/login', credentials); // ✅ Now this becomes /api/v1/auth/login

        if (response.data.tokens) {
            setAuthCookies(
                response.data.tokens.access_token,
                response.data.tokens.refresh_token
            );
        }

        return response.data;
    },

    async register(userData) {
        const response = await authAPI.post('/auth/register', userData);

        if (response.data.tokens) {
            setAuthCookies(
                response.data.tokens.access_token,
                response.data.tokens.refresh_token
            );
        }

        return response.data;
    },

    async registerEmployee(employeeData) {
        const response = await authAPI.post('/auth/register/employee', employeeData);
        return response.data;
    },

    async checkEmail(email) {
        const response = await authAPI.post('/auth/check-email', { email });
        return response.data;
    },

    async logout() {
        const response = await authAPI.post('/auth/logout');
        clearAuthCookies();
        return response.data;
    },

    async getCurrentUser() {
        const response = await authAPI.get('/auth/me');
        return response.data;
    },

    async refreshToken() {
        const refreshToken = getCookie('refresh_token');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await authAPI.post('/auth/refresh', {
            refresh_token: refreshToken,
        });

        if (response.data.tokens) {
            setAuthCookies(
                response.data.tokens.access_token,
                response.data.tokens.refresh_token
            );
        }

        return response.data;
    },
};

// Cookie helpers (keep these the same)
function setAuthCookies(accessToken, refreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token - 1 hour
    document.cookie = `access_token=${accessToken}; path=/; max-age=3600; ${isProduction ? 'Secure; SameSite=Strict' : ''
        }`;

    // Refresh token - 7 days
    document.cookie = `refresh_token=${refreshToken}; path=/; max-age=604800; ${isProduction ? 'Secure; SameSite=Strict' : ''
        }`;
}

function clearAuthCookies() {
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

export const hasRole = (user, requiredRoles) => {
    if (!user || !user.user_type) return false;

    if (Array.isArray(requiredRoles)) {
        return requiredRoles.includes(user.user_type);
    }

    return user.user_type === requiredRoles;
};

export const isAuthenticated = () => {
    return !!getCookie('access_token');
};