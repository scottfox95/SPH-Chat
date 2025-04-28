import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    console.log('Connecting to database...');
    
    // Check if projects table exists
    console.log('Checking if projects table exists...');
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'projects'
      );
    `);
    
    const projectsTableExists = tableCheckResult.rows[0].exists;
    
    if (projectsTableExists) {
      console.log('Projects table already exists, skipping creation.');
    } else {
      console.log('Creating projects table...');
      await pool.query(`
        CREATE TABLE "projects" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "created_by_id" INTEGER NOT NULL REFERENCES "users"("id"),
          "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('Projects table created successfully.');
    }
    
    // Check if project_id column exists in chatbots table
    console.log('Checking if project_id column exists in chatbots table...');
    const columnCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chatbots' 
        AND column_name = 'project_id'
      );
    `);
    
    const projectIdColumnExists = columnCheckResult.rows[0].exists;
    
    if (projectIdColumnExists) {
      console.log('project_id column already exists in chatbots table, skipping addition.');
    } else {
      console.log('Adding project_id column to chatbots table...');
      await pool.query(`
        ALTER TABLE "chatbots" 
        ADD COLUMN "project_id" INTEGER REFERENCES "projects"("id");
      `);
      console.log('project_id column added to chatbots table successfully.');
    }
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();