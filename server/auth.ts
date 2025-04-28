import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { hashPassword, comparePasswords } from "./lib/password-utils";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  // Configure session based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log environment settings
  console.log(`Configuring authentication for ${isProduction ? 'production' : 'development'} environment`);
  
  // Use environment-specific session settings
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "homebuildbot-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      secure: false, // Must be false for Replit deployments
      sameSite: 'lax',
      httpOnly: true, // Better security: client-side JS cannot access cookies
      path: '/',     // Ensure cookie is valid for all paths
    },
    store: storage.sessionStore,
  };
  
  // Trust the first proxy in the chain
  app.set("trust proxy", 1);
  
  console.log("Session settings:", {
    ...sessionSettings, 
    cookie: {
      ...sessionSettings.cookie, 
      secret: sessionSettings.secret ? "SECRET_HIDDEN" : "MISSING"
    }
  });
  
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          initial: user.initial,
        });
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to register user" });
      }
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.login(user, (loginErr: Error) => {
        if (loginErr) return next(loginErr);
        res.status(200).json({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          initial: user.initial,
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user;
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      initial: user.initial,
    });
  });

  // Auth status endpoint (for debugging authentication issues)
  app.get("/api/auth-status", (req, res) => {
    // Provide basic auth info without exposing sensitive data
    const isProduction = process.env.NODE_ENV === 'production';
    const authStatus = {
      authenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      environment: isProduction ? 'production' : 'development',
      cookieSettings: {
        secure: false,
        sameSite: 'lax',
        path: '/',
      },
      cors: {
        enabled: true,
        credentials: true
      },
      userExists: !!req.user,
      userId: req.user ? (req.user as Express.User).id : null,
      timestamp: new Date().toISOString(),
      // Include raw session cookie info for debugging
      sessionCookie: req.headers.cookie ? 
        req.headers.cookie.split(';').find(c => c.trim().startsWith('connect.sid=')) : 
        null,
      // Add database connection info
      database: {
        type: 'PostgreSQL (Replit)',
        poolSize: storage.getPoolStats ? storage.getPoolStats() : undefined
      }
    };
    
    res.json(authStatus);
  });
  
  // Middleware to check if user is authenticated
  return {
    isAuthenticated: (req: Request, res: Response, next: NextFunction) => {
      // Log authentication checks in development for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log("Auth check - session ID:", req.sessionID);
        console.log("Auth check - isAuthenticated:", req.isAuthenticated());
        if (req.user) {
          console.log("Auth check - user:", `ID: ${(req.user as Express.User).id}, Username: ${(req.user as Express.User).username}`);
        } else {
          console.log("Auth check - user: No user");
        }
      }
      
      // Standard authentication check for all environments
      if (req.isAuthenticated()) {
        return next();
      }
      
      // If not authenticated, return 401
      return res.status(401).json({ message: "Authentication required" });
    }
  };
}