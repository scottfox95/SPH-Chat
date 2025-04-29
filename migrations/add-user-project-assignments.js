/**
 * Migration script to add user_projects table
 */
import pg from 'pg';
const { Pool } = pg;

// Create connection to the database
const connectionConfig = process.env.DATABASE_URL 
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'postgres'
  };

const pool = new Pool(connectionConfig);

async function run() {
  try {
    console.log('Connecting to database...');
    
    // Check if user_projects table exists
    console.log('Checking if user_projects table exists...');
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_projects'
      );
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (tableExists) {
      console.log('user_projects table already exists, skipping creation.');
    } else {
      console.log('Creating user_projects table...');
      await pool.query(`
        CREATE TABLE "user_projects" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
          "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('user_projects table created successfully.');
      
      // Add index for faster lookups
      console.log('Adding index on user_id and project_id...');
      await pool.query(`
        CREATE INDEX idx_user_projects_user_id ON user_projects(user_id);
        CREATE INDEX idx_user_projects_project_id ON user_projects(project_id);
        CREATE UNIQUE INDEX idx_user_projects_user_project ON user_projects(user_id, project_id);
      `);
      console.log('Indexes created successfully.');
    }
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await pool.end();
  }
}

// Run the migration
run();