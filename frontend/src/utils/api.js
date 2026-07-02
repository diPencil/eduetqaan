import axios from 'axios';

// Get or generate a unique device ID for this browser session/installation
let deviceId = localStorage.getItem('etqan_device_id');
if (!deviceId) {
  // Simple UUID generation fallback
  deviceId = 'dev-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('etqan_device_id', deviceId);
}

// Create Axios Instance
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'x-device-id': deviceId
  },
  withCredentials: true // to send cookies (like refresh_token)
});

// Request Interceptor: Attach JWT Token & Device ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('etqan_access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Double check device-id is set
    config.headers['x-device-id'] = deviceId;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle Token Refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If unauthorized and not already retried
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // If we are already refreshing, push request to queue
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const localRefreshToken = localStorage.getItem('etqan_refresh_token') || '';

      try {
        // Request token refresh
        const res = await axios.post('/api/v1/students/refresh', {
          refreshToken: localRefreshToken,
          deviceId: deviceId
        }, {
          headers: {
            'x-device-id': deviceId
          },
          withCredentials: true
        });

        if (res.data && res.data.success) {
          const { accessToken, refreshToken } = res.data;
          
          localStorage.setItem('etqan_access_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('etqan_refresh_token', refreshToken);
          }

          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          
          processQueue(null, accessToken);
          isRefreshing = false;
          
          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Clear auth since refresh failed (session expired completely)
        localStorage.removeItem('etqan_access_token');
        localStorage.removeItem('etqan_refresh_token');
        localStorage.removeItem('etqan_student_data');
        
        // Optionally redirect or dispatch event
        window.dispatchEvent(new Event('etqan_unauthorized'));
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { deviceId };
