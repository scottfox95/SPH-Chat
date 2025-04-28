import { Pool } from 'pg';

console.log("Testing database connection...");
console.log(`Using DATABASE_URL environment variable`);

// Create a new Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000
});

console.log("Pool created, attempting to connect...");

// Test the connection
pool.query('SELECT NOW() as current_time')
  .then(result => {
    console.log("Connection successful!");
    console.log(`Current time: ${result.rows[0].current_time}`);
    
    // Check for tables
    return pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
  })
  .then(result => {
    console.log("Tables in database:");
    if (result.rows.length === 0) {
      console.log("  No tables found");
    } else {
      result.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }
    
    // Close connection
    return pool.end();
  })
  .then(() => {
    console.log("Connection closed");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error connecting to database:", err);
    process.exit(1);
  });