/**
 * Simple logger utility
 */
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARNING] ${message}`, ...args);
  },
  
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || '');
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
};