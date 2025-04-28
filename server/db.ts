import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

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

// Log database connection confirmed at startup
pool.query('SELECT NOW() as time')
  .then(result => {
    console.log(`Database connection confirmed at ${result.rows[0].time}`);
  })
  .catch(error => {
    console.error('Failed to connect to database at startup:', error);
  });