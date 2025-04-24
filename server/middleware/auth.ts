import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Middleware to check if user is authenticated
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = await storage.getUser(req.session.userId);
  
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  req.user = user;
  next();
};

// Middleware to check if user is an admin
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = await storage.getUser(req.session.userId);
  
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }
  
  req.user = user;
  next();
};

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
