import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Ensure we have a valid database URL
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Environment-specific database connection handling
console.log(`Initializing database connection in ${process.env.NODE_ENV || 'development'} environment`);

// Use the DATABASE_URL provided by Replit for the database connection
const dbUrl = process.env.DATABASE_URL;

// Log the database connection without exposing credentials
const maskedDbUrl = dbUrl ? 
  `${dbUrl.split('://')[0]}://[username-hidden]@[host-hidden]` : 
  'Not set';
console.log(`[DB] Using Replit-provided DATABASE_URL: ${maskedDbUrl}`);

// Connection pool settings for Replit PostgreSQL database
const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  // Basic pool settings for better performance
  max: 5,
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for initial connection (10 seconds)
  allowExitOnIdle: true, // Allow graceful shutdown
};

// Use the pooled connection for better performance
export const pool = new Pool(connectionConfig);

// Initialize drizzle ORM with our schema
export const db = drizzle({ client: pool, schema });

// Enhanced connection management
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// Log connection errors and handle reconnection
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL database error:', err);
  
  // Only attempt reconnect for connection-related errors
  if (err.message.includes('connection') || err.message.includes('timeout')) {
    console.log('Connection error detected, automatic reconnection will be attempted');
  }
});

// Only log connection status once at startup rather than periodically
// to avoid potential issues with Neon serverless connections
console.log(`Initial database pool status: Total=${pool.totalCount}, Idle=${pool.idleCount}`);

// Add a gentle health check function that can be called when needed instead of periodic monitoring
export function getDatabasePoolStatus() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount || 0,
    timestamp: new Date().toISOString()
  };
}

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

// More comprehensive database verification function
export async function verifyDatabaseSetup() {
  try {
    console.log('Verifying database setup...');
    
    // Basic connection check
    const connectionCheck = await testDatabaseConnection();
    if (!connectionCheck.connected) {
      return {
        success: false,
        step: 'connection',
        error: connectionCheck.error
      };
    }
    
    // Check for required tables
    const requiredTables = [
      'users', 'chatbots', 'documents', 'messages', 
      'summaries', 'email_recipients', 'session'
    ];
    
    const tableResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Extract table names
    const existingTables = tableResult.rows.map(row => row.table_name);
    
    // Check for missing tables
    const missingTables = requiredTables.filter(
      table => !existingTables.includes(table)
    );
    
    if (missingTables.length > 0) {
      return {
        success: false,
        step: 'schema',
        error: `Missing required tables: ${missingTables.join(', ')}`,
        existingTables,
        missingTables
      };
    }
    
    // Verify database content (e.g., check if at least one user exists)
    const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(userCheck.rows[0].count, 10);
    
    if (userCount === 0) {
      return {
        success: false,
        step: 'content',
        error: 'No users found in database',
        userCount
      };
    }
    
    // All checks passed
    return {
      success: true,
      tables: existingTables,
      userCount,
      poolInfo: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount
      },
      environment: process.env.NODE_ENV || 'development'
    };
  } catch (error) {
    console.error('Database verification failed:', error);
    return { 
      success: false, 
      step: 'unknown',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Log database connection confirmed at startup with more diagnostic info
pool.query('SELECT NOW() as time, current_database() as db_name, current_user as db_user')
  .then(result => {
    const { time, db_name, db_user } = result.rows[0];
    console.log(`=== DATABASE CONNECTION DIAGNOSTICS ===`);
    console.log(`- Connection confirmed at: ${time}`);
    console.log(`- Connected to database: ${db_name}`);
    console.log(`- Connected as user: ${db_user}`);
    console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`- Connection URL (masked): ${maskedDbUrl}`);
    console.log(`- Pool status: Total=${pool.totalCount}, Idle=${pool.idleCount}`);
    console.log(`=======================================`);
  })
  .catch(error => {
    console.error('Failed to connect to database at startup:', error);
  });