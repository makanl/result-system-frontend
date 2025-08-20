import axios from 'axios';

const api = axios.create({
  baseURL: 'https://result-system.onrender.com/', // Adjust if your backend runs elsewhere
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `JWT ${token}`;
    }
    console.log('API Request:', {
      method: config.method?.toUpperCase(),
      url: `${config.baseURL}${config.url}`,
      headers: {
        'Content-Type': config.headers['Content-Type'],
        'Authorization': config.headers['Authorization'] ? 'Present' : 'Missing'
      },
      data: config.data
    });
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token refresh and log errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response Success:', {
      status: response.status,
      url: response.config.url,
      dataLength: response.data ? Object.keys(response.data).length : 0
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.error('API Error Response:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      fullUrl: `${error.config?.baseURL}${error.config?.url}`,
      data: error.response?.data,
      message: error.message,
      code: error.code
    });
    
    // Log the full error for debugging
    if (error.response?.data) {
      console.error('Backend Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Handle 401 Unauthorized errors - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh');
        if (refreshToken) {
          console.log('Attempting token refresh...');
          const refreshResponse = await axios.post('https://result-system.onrender.com/auth/jwt/refresh/', {
            refresh: refreshToken
          });
          
          const newAccessToken = refreshResponse.data.access;
          localStorage.setItem('access', newAccessToken);
          
          // Retry the original request with new token
          originalRequest.headers['Authorization'] = `JWT ${newAccessToken}`;
          console.log('Token refreshed, retrying original request...');
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Clear invalid tokens and redirect to login
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;