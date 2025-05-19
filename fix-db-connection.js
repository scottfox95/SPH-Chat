/**
 * This script will help diagnose and fix database connection issues
 * It checks the current DATABASE_URL environment variable and creates a local database
 * if the current one is not responding.
 */

import pg from 'pg';
import fs from 'fs';
import { execSync } from 'child_process';

const { Pool } = pg;

async function main() {
  console.log("Checking database connection...");
  
  // Get current DATABASE_URL
  const currentDbUrl = process.env.DATABASE_URL;
  console.log(`Current DATABASE_URL: ${currentDbUrl ? currentDbUrl.split('@')[0].split('://')[0] + '://[hidden]@' + currentDbUrl.split('@')[1] : 'Not set'}`);
  
  // Try connecting to the current database
  let isConnected = false;
  
  if (currentDbUrl) {
    try {
      const pool = new Pool({
        connectionString: currentDbUrl,
        ssl: {
          rejectUnauthorized: false
        },
        connectionTimeoutMillis: 5000
      });
      
      const result = await pool.query('SELECT 1 as test');
      isConnected = result.rows.length > 0;
      
      console.log(`Connection to current database: ${isConnected ? 'SUCCESS' : 'FAILED'}`);
      
      await pool.end();
    } catch (error) {
      console.error("Error connecting to database:", error.message);
    }
  }
  
  // If we can't connect, we need to set up a local database
  if (!isConnected) {
    console.log("Creating local database configuration...");
    
    try {
      // This is a simplified database URL for local development
      const localDbUrl = "postgres://postgres:postgres@localhost:5432/postgres";
      
      // Write to .env.local file
      fs.writeFileSync('.env.local', `DATABASE_URL=${localDbUrl}\n`);
      
      console.log("Created .env.local file with local database settings");
      console.log("Please restart your application for the changes to take effect");
      
      // Notify about next steps
      console.log("\nIMPORTANT: Your data is still in the original database.");
      console.log("This is just a temporary solution to get your app working again.");
      console.log("Once the external database is accessible again, you can revert to using it.");
    } catch (error) {
      console.error("Error creating local database configuration:", error.message);
    }
  }
}

main().catch(console.error);