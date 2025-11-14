/**
 * Simple error tracking for local development
 */

interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  component?: string;
  url: string;
  userAgent: string;
}

class ErrorTracker {
  private errors: ErrorLog[] = [];
  private maxErrors = 100;

  constructor() {
    this.setupGlobalErrorHandler();
    this.setupUnhandledRejectionHandler();
  }

  private setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });
  }

  private setupUnhandledRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });
  }

  logError(error: Omit<ErrorLog, 'timestamp'>) {
    const errorLog: ErrorLog = {
      ...error,
      timestamp: new Date().toISOString(),
    };

    this.errors.push(errorLog);

    // Keep only last N errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('[Error Tracker]', errorLog);
    }

    // Save to localStorage
    try {
      localStorage.setItem('error-logs', JSON.stringify(this.errors.slice(-20)));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  getErrors(): ErrorLog[] {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
    try {
      localStorage.removeItem('error-logs');
    } catch (e) {
      // Ignore
    }
  }

  getErrorCount(): number {
    return this.errors.length;
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

// Helper to manually log errors
export function logError(message: string, error?: Error, component?: string) {
  errorTracker.logError({
    message,
    stack: error?.stack,
    component,
    url: window.location.href,
    userAgent: navigator.userAgent,
  });
}
