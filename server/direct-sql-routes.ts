/**
 * PRODUCTION EMERGENCY FIX
 * 
 * This file contains direct SQL implementations of critical routes
 * to work around potential database schema differences between environments.
 */

import express from 'express';
import { pool } from './db';
import { nanoid } from 'nanoid';

const directSqlRouter = express.Router();

// Health check endpoint
directSqlRouter.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    return res.json({
      status: 'ok',
      timestamp: result.rows[0].current_time,
      message: 'Database connection successful'
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Direct SQL implementation of chatbot creation
directSqlRouter.post('/chatbots', async (req, res) => {
  try {
    console.log('[DIRECT SQL] Attempting to create chatbot with body:', req.body);
    const { name, slackChannelId } = req.body;
    
    if (!name || !slackChannelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Name and slackChannelId are required'
      });
    }
    
    // Generate a unique public token
    const publicToken = nanoid(10);
    
    // Find an existing user to set as creator
    const client = await pool.connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      // Check if we need to create a user first
      const userCheck = await client.query('SELECT COUNT(*) as count FROM users');
      if (parseInt(userCheck.rows[0].count, 10) === 0) {
        console.log('[DIRECT SQL] No users found, creating admin user');
        // Create an admin user
        await client.query(`
          INSERT INTO users (username, password, display_name, role, initial) 
          VALUES ('admin', 'password_hash_placeholder', 'Admin User', 'admin', 'A')
        `);
      }
      
      // Get first user ID
      const userResult = await client.query('SELECT id FROM users ORDER BY id LIMIT 1');
      if (userResult.rows.length === 0) {
        throw new Error('Could not find or create a user');
      }
      
      const userId = userResult.rows[0].id;
      console.log('[DIRECT SQL] Using user ID for chatbot creator:', userId);
      
      // Check chatbots table structure
      console.log('[DIRECT SQL] Checking chatbots table structure');
      const tableInfo = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'chatbots'
      `);
      
      console.log('[DIRECT SQL] Chatbots table structure:', tableInfo.rows);
      
      // Create chatbot
      console.log('[DIRECT SQL] Inserting new chatbot');
      const result = await client.query(`
        INSERT INTO chatbots (
          name, 
          slack_channel_id, 
          created_by_id, 
          public_token, 
          is_active, 
          require_auth
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        name,
        slackChannelId,
        userId,
        publicToken,
        true,
        false
      ]);
      
      // Commit the transaction
      await client.query('COMMIT');
      
      console.log('[DIRECT SQL] Successfully created chatbot:', result.rows[0]);
      return res.status(201).json(result.rows[0]);
    } catch (dbError: any) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[DIRECT SQL] Error creating chatbot:', error);
    
    // Special case for constraints
    if (error.code === '23505') {
      return res.status(400).json({
        status: 'error',
        message: 'A chatbot with that name or token already exists',
        errorCode: error.code,
        constraint: error.constraint
      });
    }
    
    // Table doesn't exist
    if (error.code === '42P01') {
      return res.status(500).json({
        status: 'error',
        message: 'Database tables not properly set up',
        details: 'The chatbots table does not exist. Run database migrations first.',
        errorCode: error.code
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create chatbot',
      error: error.message,
      code: error.code || 'unknown',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all chatbots
directSqlRouter.get('/chatbots', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM chatbots ORDER BY id');
    client.release();
    
    return res.json(result.rows);
  } catch (error: any) {
    console.error('[DIRECT SQL] Error fetching chatbots:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch chatbots',
      error: error.message
    });
  }
});

// Create table if not exists
directSqlRouter.post('/setup', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        initial TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create chatbots table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatbots (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slack_channel_id TEXT NOT NULL,
        asana_project_id TEXT,
        asana_connection_id TEXT,
        created_by_id INTEGER NOT NULL,
        public_token TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        require_auth BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create admin user if none exists
    const userCheck = await client.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO users (username, password, display_name, role, initial) 
        VALUES ('admin', 'password_hash_placeholder', 'Admin User', 'admin', 'A')
      `);
    }
    
    client.release();
    
    return res.json({
      status: 'ok',
      message: 'Database tables created successfully'
    });
  } catch (error: any) {
    console.error('[DIRECT SQL] Error setting up database:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to set up database',
      error: error.message
    });
  }
});

export default directSqlRouter;