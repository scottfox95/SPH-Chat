/**
 * Emergency routes to allow basic functionality when the main database is having issues
 * This file provides simplified, direct SQL access for critical operations
 */

const express = require('express');
const { nanoid } = require('nanoid');
const { pool } = require('./db');

const emergencyRouter = express.Router();

// GET health check - tests database connection
emergencyRouter.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.json({
      status: 'ok',
      timestamp: result.rows[0].now,
      message: 'Database connection is working'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// GET all chatbots - simplified direct SQL query
emergencyRouter.get('/chatbots', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM chatbots ORDER BY id');
    client.release();
    
    res.json(result.rows);
  } catch (error) {
    console.error('Emergency chatbot list error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch chatbots',
      error: error.message
    });
  }
});

// GET users - simplified direct SQL query
emergencyRouter.get('/users', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT id, username, display_name, role FROM users');
    client.release();
    
    res.json(result.rows);
  } catch (error) {
    console.error('Emergency users list error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// POST create chatbot - simplified direct SQL with minimal parameters
emergencyRouter.post('/chatbot', async (req, res) => {
  const { name, slackChannelId } = req.body;
  
  if (!name || !slackChannelId) {
    return res.status(400).json({
      status: 'error',
      message: 'Name and slackChannelId are required'
    });
  }
  
  try {
    // Generate token
    const publicToken = nanoid(10);
    
    // Get first available user ID to use as creator_by_id
    const client = await pool.connect();
    
    // First check if any users exist
    const userCheck = await client.query('SELECT id FROM users LIMIT 1');
    
    if (userCheck.rows.length === 0) {
      // No users found, create admin user first
      await client.query(`
        INSERT INTO users (username, password, display_name, role, initial) 
        VALUES ('admin', '$2b$10$mQI.29mL5VmgZA57BIz3LOxVUzCNnRk5UZJGHS.JKqfM93ybHgVS6', 'Admin User', 'admin', 'A')
      `);
    }
    
    // Get user ID (now we know at least one exists)
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    const userId = userResult.rows[0].id;
    
    // Insert chatbot with minimal required fields
    const result = await client.query(`
      INSERT INTO chatbots (name, slack_channel_id, created_by_id, public_token, is_active, require_auth)
      VALUES ($1, $2, $3, $4, true, false)
      RETURNING *
    `, [name, slackChannelId, userId, publicToken]);
    
    client.release();
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Emergency chatbot creation error:', error);
    
    // Check if it's a unique violation on public_token
    if (error.code === '23505' && error.constraint === 'chatbots_public_token_key') {
      return res.status(500).json({
        status: 'error',
        message: 'Token collision, please try again'
      });
    }
    
    // Check if the chatbots table exists
    if (error.code === '42P01') {
      return res.status(500).json({
        status: 'error',
        message: 'Chatbots table does not exist. Database schema needs to be created.'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to create chatbot',
      error: error.message,
      code: error.code
    });
  }
});

module.exports = emergencyRouter;