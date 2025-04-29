import { Request, Response, NextFunction } from "express";

/**
 * Utility function to handle async route handlers
 * Eliminates the need for try/catch blocks in every route
 * 
 * @param fn The async route handler function
 * @returns A function that wraps the handler with error handling
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };