/**
 * Migration script to add summary_prompt column to settings table
 */
import pg from 'pg';
const { Pool } = pg;

async function run() {
  console.log('Running migration to add summary_prompt column to settings table');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'settings'
      AND column_name = 'summary_prompt';
    `);

    if (checkResult.rows.length > 0) {
      console.log('Column summary_prompt already exists in settings table');
      return;
    }

    // Add the column
    await pool.query(`
      ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS summary_prompt TEXT;
    `);

    console.log('Successfully added summary_prompt column to settings table');
  } catch (error) {
    console.error('Error executing migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run().catch(console.error);