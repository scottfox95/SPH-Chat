#!/usr/bin/env node

/**
 * Create the PostgreSQL session table
 * 
 * This script creates the session table needed for connect-pg-simple
 * Run this script once before starting the application.
 */

import { Pool } from 'pg';

// Create the session table
async function createSessionTable() {
  console.log('Creating session table...');
  
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Check if table already exists
    const check = await pool.query(`
      SELECT to_regclass('public.session') as table_exists;
    `);
    
    if (check.rows[0].table_exists) {
      console.log('Session table already exists.');
      return;
    }
    
    // Create the session table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    
    // Create index on expire column
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    
    console.log('Session table and indexes created successfully.');
  } catch (err) {
    console.error('Error creating session table:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run the function directly when executed as a script
createSessionTable()
  .then(() => {
    console.log('Session table creation completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to create session table:', err);
    process.exit(1);
  });

export { createSessionTable };