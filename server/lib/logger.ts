/**
 * Simple logger utility
 */
export const logger = {
  /**
   * Log info message
   * @param message Message to log
   * @param context Optional context object
   */
  info: (message: string, context?: any): void => {
    console.log(`[INFO] ${message}`, context ? context : '');
  },

  /**
   * Log warning message
   * @param message Message to log
   * @param context Optional context object
   */
  warn: (message: string, context?: any): void => {
    console.warn(`[WARN] ${message}`, context ? context : '');
  },

  /**
   * Log error message
   * @param message Message to log
   * @param error Optional error object
   * @param context Optional context object
   */
  error: (message: string, error?: Error | unknown, context?: any): void => {
    console.error(`[ERROR] ${message}`, error ? error : '', context ? context : '');
  },

  /**
   * Log debug message (only in development)
   * @param message Message to log
   * @param context Optional context object
   */
  debug: (message: string, context?: any): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, context ? context : '');
    }
  },

  /**
   * Log scheduler-related message
   * @param message Message to log
   * @param context Optional context object
   */
  scheduler: (message: string, context?: any): void => {
    console.log(`[SCHEDULER] ${message}`, context ? context : '');
  }
};