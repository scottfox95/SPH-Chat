import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { User as SchemaUser } from "@shared/schema";

// Extend Express Session to include userId
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

// Middleware to check if user is authenticated
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  next();
};

// Middleware to check if user is an admin
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user as SchemaUser;
  
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }
  
  next();
};

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface User extends SchemaUser {}
  }
}
