import axios from 'axios';

// Create single axios instance with default config
const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
    timeout: 30000, // Default 30 seconds
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false, // No cookies needed with JWT in headers
});

// Track if we're currently clearing invalid tokens to prevent loops
let isClearing = false;

// Add request interceptor to include JWT token in Authorization header
api.interceptors.request.use(
    config => {
        // Don't add token if we're currently clearing invalid tokens
        if (!isClearing) {
            const token = localStorage.getItem('authToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401 && !isClearing) {
            // Token expired or invalid, clear it safely
            clearAuthToken();

            // Redirect to login/refresh page after clearing
            setTimeout(() => {
                window.location.href = '/';
            }, 100);
        }
        return Promise.reject(error);
    }
);

// API endpoints
export const API_ENDPOINTS = {
    // Authentication
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',

    // Reports
    TIMEZONES: '/api/reports/timezones',
    MULTI_REPORTS: accountIds => `/api/reports/multi/${accountIds}`,
    DETAILED_TRANSACTIONS: accountIds => `/api/reports/detailed/${accountIds}`,
    ACCOUNTS: '/api/reports/accounts',

    // Export
    EXPORT_CSV: accountId => `/api/export/csv/${accountId}`,
    EXPORT_XLS: accountId => `/api/export/xls/${accountId}`,
    EXPORT_PDF: accountId => `/api/export/pdf/${accountId}`,
    EXPORT_EMAIL: accountId => `/api/export/email/${accountId}`,
    EXPORT_GOOGLE_SHEETS: accountId => `/api/export/sheets/${accountId}`,

    // Validation
    VALIDATE_KEYS: '/api/validate-keys',
};

// Authentication functions
export const login = async (username, password) => {
    const response = await api.post(API_ENDPOINTS.LOGIN, { username, password });
    if (response.data.token) {
        // Store JWT token in localStorage
        localStorage.setItem('authToken', response.data.token);
    }
    return response;
};

export const logout = async () => {
    try {
        // Call server logout endpoint (optional)
        await api.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
        // Even if server logout fails, clear local token
        console.warn('Server logout failed:', error);
    } finally {
        // Always clear local token using our safe method
        clearAuthToken();
    }
};

export const checkAuthStatus = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        throw new Error('No auth token found');
    }
    const response = await api.get(API_ENDPOINTS.ME);
    return response;
};

// Check if user is authenticated
export const isAuthenticated = () => {
    return !!localStorage.getItem('authToken');
};

// Clear authentication token and prevent it from being sent in headers
export const clearAuthToken = () => {
    isClearing = true;
    localStorage.removeItem('authToken');
    setTimeout(() => {
        isClearing = false;
    }, 100);
};

// API functions
export const apiService = {
    // Timezone functions
    getTimezones: async () => {
        const response = await api.get(API_ENDPOINTS.TIMEZONES);
        return response.data;
    },

    // Account functions
    getAccounts: async headers => {
        const response = await api.get(API_ENDPOINTS.ACCOUNTS, { headers });
        return response.data;
    },

    // Report functions (use longer timeout for potentially heavy queries)
    getMultiAccountReport: async (accountIds, params, headers) => {
        const response = await api.get(API_ENDPOINTS.MULTI_REPORTS(accountIds), {
            params,
            headers,
            timeout: 600000, // 10 minutes for multi-account report generation
        });
        return response.data;
    },

    // Detailed transactions function
    getDetailedTransactions: async (accountIds, startDate, endDate, timezone, page = 1, limit = 50, headers) => {
        const params = {
            start_date: startDate,
            end_date: endDate,
            timezone,
            period: 'custom',
            page,
            limit,
        };
        const response = await api.get(API_ENDPOINTS.DETAILED_TRANSACTIONS(accountIds), {
            params,
            headers,
            timeout: 300000, // 5 minutes for detailed transaction queries
        });
        return response.data;
    },

    // Export functions (use longer timeout for export operations)
    exportToCSV: async (accountId, data, headers) => {
        const response = await api.post(API_ENDPOINTS.EXPORT_CSV(accountId), data, {
            headers,
            timeout: 300000, // 5 minutes for export operations
            responseType: 'blob', // Handle binary data
        });
        return response;
    },

    exportToXLS: async (accountId, data, headers) => {
        const response = await api.post(API_ENDPOINTS.EXPORT_XLS(accountId), data, {
            headers,
            timeout: 300000, // 5 minutes for export operations
            responseType: 'blob', // Handle binary data
        });
        return response;
    },

    exportToPDF: async (accountId, data, headers) => {
        const response = await api.post(API_ENDPOINTS.EXPORT_PDF(accountId), data, {
            headers,
            timeout: 300000, // 5 minutes for export operations
            responseType: 'blob', // Handle binary data
        });
        return response;
    },

    exportToEmail: async (accountId, data, headers) => {
        const response = await api.post(API_ENDPOINTS.EXPORT_EMAIL(accountId), data, {
            headers,
            timeout: 300000, // 5 minutes for export operations
        });
        return response.data;
    },

    exportToGoogleSheets: async (accountId, data, headers) => {
        const response = await api.post(API_ENDPOINTS.EXPORT_GOOGLE_SHEETS(accountId), data, {
            headers,
            timeout: 300000, // 5 minutes for export operations
            responseType: 'blob', // Handle binary data
        });
        return response;
    },
};

export default api;
