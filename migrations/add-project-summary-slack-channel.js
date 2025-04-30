import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Connect to database
const client = postgres(process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/dbname');
const db = drizzle(client);

async function main() {
  try {
    console.log('Running migration: add-project-summary-slack-channel.js');
    
    // Check if the column exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'project_summaries' 
      AND column_name = 'slack_channel_id';
    `;
    
    const columnExists = await client.unsafe(checkQuery);
    
    if (columnExists.length === 0) {
      console.log('Adding slack_channel_id column to project_summaries table');
      
      // Add the new column
      const alterQuery = `
        ALTER TABLE project_summaries
        ADD COLUMN slack_channel_id TEXT NULL;
      `;
      
      await client.unsafe(alterQuery);
      console.log('Successfully added slack_channel_id column to project_summaries table');
    } else {
      console.log('Column slack_channel_id already exists in project_summaries table');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();