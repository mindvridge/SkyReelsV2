/**
 * Axios Configuration with Error Handling and Retry Logic
 */

import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with default config
export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Track retry counts
const retryCount = new Map<string, number>();

/**
 * Delay function for retry logic
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determine if error is retryable
 */
const isRetryableError = (error: AxiosError): boolean => {
  if (!error.response) {
    // Network errors (no response) are retryable
    return true;
  }

  const status = error.response.status;

  // Retry on:
  // - 408 Request Timeout
  // - 429 Too Many Requests
  // - 500+ Server Errors
  return status === 408 || status === 429 || status >= 500;
};

/**
 * Get retry delay with exponential backoff
 */
const getRetryDelay = (retryNumber: number): number => {
  return RETRY_DELAY * Math.pow(2, retryNumber - 1);
};

/**
 * Request interceptor
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add timestamp to prevent caching
    if (config.params) {
      config.params._t = Date.now();
    } else {
      config.params = { _t: Date.now() };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor with retry logic
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Clear retry count on success
    if (response.config.url) {
      retryCount.delete(response.config.url);
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config;

    if (!config || !config.url) {
      return Promise.reject(error);
    }

    // Check if error is retryable
    if (!isRetryableError(error)) {
      return Promise.reject(error);
    }

    // Get current retry count
    const currentRetry = retryCount.get(config.url) || 0;

    // Check if max retries exceeded
    if (currentRetry >= MAX_RETRIES) {
      retryCount.delete(config.url);
      console.error(`[API] Max retries (${MAX_RETRIES}) exceeded for ${config.url}`);
      return Promise.reject(error);
    }

    // Increment retry count
    retryCount.set(config.url, currentRetry + 1);

    // Calculate delay with exponential backoff
    const retryDelay = getRetryDelay(currentRetry + 1);

    console.log(
      `[API] Retrying ${config.url} (${currentRetry + 1}/${MAX_RETRIES}) after ${retryDelay}ms`
    );

    // Wait before retrying
    await delay(retryDelay);

    // Retry request
    return api(config);
  }
);

/**
 * Error response handler with user-friendly messages
 */
export const handleApiError = (error: AxiosError, context?: string): string => {
  let message = 'An unexpected error occurred';

  if (!error.response) {
    // Network error
    if (!navigator.onLine) {
      message = 'No internet connection. Please check your network.';
    } else {
      message = 'Unable to reach the server. Please try again.';
    }
  } else {
    const status = error.response.status;
    const data = error.response.data as any;

    switch (status) {
      case 400:
        message = data?.detail || 'Invalid request. Please check your input.';
        break;
      case 401:
        message = 'Unauthorized. Please log in again.';
        break;
      case 403:
        message = 'Access denied. You do not have permission for this action.';
        break;
      case 404:
        message = data?.detail || 'The requested resource was not found.';
        break;
      case 408:
        message = 'Request timeout. The server took too long to respond.';
        break;
      case 413:
        message = 'File too large. Please upload a smaller file.';
        break;
      case 429:
        message = 'Too many requests. Please slow down and try again later.';
        break;
      case 500:
        message = 'Server error. Please try again later.';
        break;
      case 502:
        message = 'Bad gateway. The server is temporarily unavailable.';
        break;
      case 503:
        message = 'Service unavailable. Please try again later.';
        break;
      case 504:
        message = 'Gateway timeout. The server took too long to respond.';
        break;
      default:
        message = data?.detail || data?.message || `Error ${status}: ${error.message}`;
    }
  }

  // Add context if provided
  if (context) {
    message = `${context}: ${message}`;
  }

  return message;
};

/**
 * Network status monitoring
 */
export const setupNetworkMonitoring = () => {
  // Online event
  window.addEventListener('online', () => {
    console.log('[Network] Connection restored');
    toast.success('Internet connection restored');
  });

  // Offline event
  window.addEventListener('offline', () => {
    console.log('[Network] Connection lost');
    toast.error('No internet connection', {
      duration: Infinity,
      id: 'offline-toast',
    });
  });

  // Check initial state
  if (!navigator.onLine) {
    toast.error('No internet connection', {
      duration: Infinity,
      id: 'offline-toast',
    });
  }
};

/**
 * Check if online
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

export default api;
