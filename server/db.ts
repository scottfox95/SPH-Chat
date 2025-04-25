import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for websocket connections through proxies
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Environment-specific database connection handling
console.log(`Initializing database connection in ${process.env.NODE_ENV || 'development'} environment`);

// Use the pooled connection for better performance
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Add connection pool settings to improve stability
  max: 20, // Maximum number of connections 
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Timeout after 5 seconds when connecting
});

// Initialize drizzle ORM with our schema
export const db = drizzle({ client: pool, schema });

// Log successful connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// Log connection errors
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL database error:', err);
});

// Export connection test function for health checks
export async function testDatabaseConnection() {
  try {
    const result = await pool.query('SELECT 1 as test');
    return { 
      connected: true, 
      details: `Successfully connected to database (pool: ${pool.totalCount} connections, idle: ${pool.idleCount})`
    };
  } catch (error) {
    console.error('Database connection test failed:', error);
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}