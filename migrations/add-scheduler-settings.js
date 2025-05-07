/**
 * Migration script to add scheduler settings columns to settings table
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

async function run() {
  const pool = new Pool(connectionConfig);
  
  try {
    console.log('Starting migration: add scheduler settings columns');
    
    // Add scheduler settings columns
    await pool.query(`
      ALTER TABLE "settings"
      ADD COLUMN IF NOT EXISTS "enable_daily_schedule" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "daily_schedule_time" TEXT DEFAULT '08:00',
      ADD COLUMN IF NOT EXISTS "enable_weekly_schedule" BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "weekly_schedule_day" TEXT DEFAULT 'Monday',
      ADD COLUMN IF NOT EXISTS "weekly_schedule_time" TEXT DEFAULT '08:00'
    `);
    
    console.log('Successfully added scheduler settings columns');
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the migration
run()
  .then(() => console.log('Migration completed successfully'))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });