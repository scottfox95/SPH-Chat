/**
 * Migration script to add output_format column to chatbots table
 */
import pg from 'pg';
const { Pool } = pg;

async function run() {
  // Create a connection to the database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Add the output_format column to the chatbots table if it doesn't exist
    console.log('Adding output_format column to chatbots table...');
    await pool.query(`
      ALTER TABLE chatbots
      ADD COLUMN IF NOT EXISTS output_format TEXT
    `);

    console.log('Migration complete! Added output_format column to chatbots table.');
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