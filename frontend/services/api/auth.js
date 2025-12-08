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

// Response interceptor to handle 401 errors
authAPI.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // If we get a 401 and haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                // Try to refresh the token
                await authService.refreshToken();
                // Retry the original request with new token
                return authAPI(originalRequest);
            } catch (refreshError) {
                // Refresh failed, clear cookies and reject
                clearAuthCookies();
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);

export const authService = {
    async login(credentials) {
        try {
            console.log('Login request sent to:', '/auth/login');
            const response = await authAPI.post('/auth/login', credentials);
            const data = response.data;

            console.log('Login API response data:', data);
            console.log('Response headers (Set-Cookie):', response.headers['set-cookie']);

            // Cookies are now set by the backend via Set-Cookie headers
            // Verify cookies were set
            setTimeout(() => {
                console.log('All cookies after login:', document.cookie);
                const accessToken = getCookie('access_token');
                const refreshToken = getCookie('refresh_token');
                console.log('Cookie verification:', {
                    access_token: accessToken ? 'SET ✓' : 'NOT SET ✗',
                    refresh_token: refreshToken ? 'SET ✓' : 'NOT SET ✗'
                });
            }, 100);

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
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
            const token = getCookie('access_token');
            console.log('Access token for request:', token ? 'EXISTS' : 'MISSING');
            
            const response = await authAPI.get('/auth/me');
            
            console.log('getCurrentUser response:', response.data);
            
            // Return the response data which should have success and user properties
            return response.data;
        } catch (error) {
            console.error('Get current user failed:', error);
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

// Cookie helpers - FIXED VERSION
function setAuthCookies(accessToken, refreshToken) {
    console.log('Setting cookies with tokens:', {
        accessTokenLength: accessToken?.length,
        refreshTokenLength: refreshToken?.length
    });

    // Check if we're on localhost
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    // For localhost, use minimal cookie attributes
    if (isLocalhost) {
        // Simple cookie setting for localhost
        document.cookie = `access_token=${accessToken}; path=/; max-age=3600; SameSite=Lax`;
        document.cookie = `refresh_token=${refreshToken}; path=/; max-age=604800; SameSite=Lax`;
    } else {
        // Production settings
        document.cookie = `access_token=${accessToken}; path=/; max-age=3600; Secure; SameSite=None`;
        document.cookie = `refresh_token=${refreshToken}; path=/; max-age=604800; Secure; SameSite=None`;
    }

    // Verify immediately
    const verifyAccess = getCookie('access_token');
    const verifyRefresh = getCookie('refresh_token');
    console.log('Cookie verification:', {
        accessTokenSet: !!verifyAccess,
        refreshTokenSet: !!verifyRefresh,
        allCookies: document.cookie
    });
}

function clearAuthCookies() {
    // Try multiple methods to clear cookies
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    
    // Also try without path
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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