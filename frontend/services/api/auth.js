import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const authAPI = axios.create({
    baseURL: `${API_BASE_URL}`, 
    withCredentials: true,
});

// Request interceptor to add auth token
authAPI.interceptors.request.use(
    (config) => {
        const token = getCookie('access_token');
        console.log('Current token:', token); // Debug log
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const authService = {
    async login(credentials) {
        const response = await authAPI.post('/auth/login', credentials);
        const data = response.data;

        console.log('Login API response:', data);

        if (data.tokens) {
            setAuthCookies(
                data.tokens.access_token,
                data.tokens.refresh_token
            );
        }

        return data;
    },

    async register(userData) {
        const response = await authAPI.post('/auth/register', userData);
        const data = response.data;

        if (data.tokens) {
            setAuthCookies(
                data.tokens.access_token,
                data.tokens.refresh_token
            );
        }

        return data;
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
        try {
            console.log('Cookies before request:', document.cookie);
            const response = await authAPI.get('/auth/me');
            console.log('Auth me response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Get current user failed:', error);
            console.error('Error details:', error.response?.data);
            return { success: false, error: 'Failed to get user' };
        }
    },

    async refreshToken() {
        const response = await authAPI.post('/auth/refresh');
        const data = response.data;
        
        if (data.tokens) {
            setAuthCookies(
                data.tokens.access_token,
                data.tokens.refresh_token
            );
        }

        return data;
    },
};

// Cookie helpers
function setAuthCookies(accessToken, refreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';
    const sameSite = isProduction ? 'None' : 'Lax';
    const secureFlag = isProduction ? 'Secure;' : '';

    // Access token
    document.cookie = `access_token=${accessToken}; path=/; max-age=3600; ${secureFlag} SameSite=${sameSite}`;

    // Refresh token
    document.cookie = `refresh_token=${refreshToken}; path=/; max-age=604800; ${secureFlag} SameSite=${sameSite}`;

    console.log('Cookies after setting:', document.cookie);
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