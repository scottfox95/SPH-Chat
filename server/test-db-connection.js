#!/usr/bin/env node

/**
 * Database connection test script
 * 
 * This script can be run directly to verify database connectivity,
 * especially useful for production environment testing or CI/CD pipelines.
 * 
 * Usage:
 *   node server/test-db-connection.js
 * 
 * Requirements:
 *   - DATABASE_URL environment variable must be set
 */

// We need to load any .env file first
try {
  require('dotenv').config();
} catch (err) {
  console.log('No dotenv package found, continuing with existing environment variables');
}

const { Pool } = require('@neondatabase/serverless');

// Validate environment variables
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

async function testConnection() {
  console.log('Testing database connection...');
  console.log(`Database URL format check: ${process.env.DATABASE_URL.substring(0, 10)}...`);
  
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000
  });

  try {
    console.log('Connecting to database...');
    const startTime = Date.now();
    
    // Basic connectivity test
    const result = await pool.query('SELECT NOW() as time');
    const endTime = Date.now();
    
    console.log('✅ Database connection successful!');
    console.log(`Time: ${result.rows[0].time}`);
    console.log(`Connection established in ${endTime - startTime}ms`);
    
    // Check required tables
    console.log('\nChecking database schema...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} tables in database:`);
    tables.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Expected tables for the application
    const expectedTables = [
      'users', 'chatbots', 'documents', 'messages', 
      'summaries', 'email_recipients', 'session'
    ];
    
    const missingTables = expectedTables.filter(
      table => !tables.rows.some(row => row.table_name === table)
    );
    
    if (missingTables.length > 0) {
      console.warn('\n⚠️ WARNING: The following expected tables are missing:');
      missingTables.forEach(table => console.warn(`- ${table}`));
      console.log('\nYou may need to run migrations or initialize the database.');
    } else {
      console.log('\n✅ All expected tables are present');
    }
    
    // Connection pool stats
    console.log(`\nConnection pool statistics:`);
    console.log(`- Total connections: ${pool.totalCount}`);
    console.log(`- Idle connections: ${pool.idleCount}`);
    console.log(`- Waiting clients: ${pool.waitingCount}`);
    
    await pool.end();
    
    console.log('\n✅ Database test completed successfully');
    return true;
  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error(error);
    
    try {
      await pool.end();
    } catch (closeErr) {
      // Ignore errors during closing the pool
    }
    
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
} else {
  // Export for use in other scripts
  module.exports = { testConnection };
}