import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";
import path from "path";
import { runMigration } from "./lib/data-migration";
import { initializeSchedulerOnStartup } from "./lib/scheduler";
import { logger } from "./lib/logger";

// Configure environment-specific settings
const isProduction = process.env.NODE_ENV === 'production';

// Setup CORS for all environments
// In production, we need to be specific about allowed origins
const corsOptions = {
  credentials: true,
  origin: isProduction 
    ? [
        'https://sphbuddy.info', 
        'https://www.sphbuddy.info',
        // Allow localhost for development testing
        'http://localhost:5000'
      ] 
    : true, // Allow any origin in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors(corsOptions));

// Log database connection URL at startup
console.log(
  "[boot] Using DB →",
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.REPLIT_DB_URL
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // Run data migration utility to ensure development data is preserved in production
  try {
    log("Running data migration utility...");
    await runMigration();
    log("Data migration completed.");
  } catch (error) {
    console.error("Error during data migration:", error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error(`Error: ${err.message || 'Unknown error'}`);
    res.status(status).json({ message });
    // Removed unnecessary throw which happens after response is sent
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
    
    // Add explicit handler for root path in production
    app.get('/', (req, res) => {
      res.sendFile(path.resolve(import.meta.dirname, "public", "index.html"));
    });
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Initialize the scheduler
    initializeSchedulerOnStartup()
      .then(() => {
        logger.info('Scheduler initialized successfully');
      })
      .catch(error => {
        logger.error('Failed to initialize scheduler', error);
      });
  });
})();
