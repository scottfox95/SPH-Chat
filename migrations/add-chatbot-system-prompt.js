/**
 * Migration script to add system_prompt column to chatbots table
 */
import pg from 'pg';
const { Pool } = pg;

async function run() {
  // Create a connection to the database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Add the system_prompt column to the chatbots table if it doesn't exist
    console.log('Adding system_prompt column to chatbots table...');
    await pool.query(`
      ALTER TABLE chatbots
      ADD COLUMN IF NOT EXISTS system_prompt TEXT
    `);

    console.log('Migration complete! Added system_prompt column to chatbots table.');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
run().catch(error => {
  console.error('Unhandled error in migration:', error);
  process.exit(1);
});