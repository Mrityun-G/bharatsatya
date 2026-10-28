import axios from 'axios';
import { demoAdapter, demoMode } from './demoData';

export function createApiClient(useDemoMode = demoMode) {
  const client = axios.create({
    // Demo builds are entirely browser-local. No request can reach the API in this mode.
    baseURL: useDemoMode ? '/' : '/api',
    ...(useDemoMode ? { adapter: demoAdapter } : {}),
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    if (useDemoMode) return config;
    const token = localStorage.getItem('bharatsatya_auth_token');
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (!useDemoMode && error.response?.status === 401 && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('bharatsatya_auth_token');
        localStorage.removeItem('bharatsatya_auth_user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
  return client;
}

const api = createApiClient();
export default api;
