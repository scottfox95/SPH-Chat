-- This script will recreate the tables with a compatible schema
-- You should run this in your production database

-- First, check the current schema
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('users', 'chatbots', 'chatbot_asana_projects', 'documents', 'summaries', 'email_recipients', 'messages', 'settings', 'api_tokens')
ORDER BY table_name, ordinal_position;

-- If the chatbots table is missing or has schema issues, recreate it:
DROP TABLE IF EXISTS chatbots CASCADE;

CREATE TABLE chatbots (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slack_channel_id TEXT NOT NULL,
  asana_project_id TEXT,
  asana_connection_id TEXT,
  created_by_id INTEGER NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  require_auth BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- If needed, create basic admin user (if missing)
INSERT INTO users (username, password, display_name, role, initial, created_at)
SELECT 'admin', '$2b$10$mQI.29mL5VmgZA57BIz3LOxVUzCNnRk5UZJGHS.JKqfM93ybHgVS6', 'Admin User', 'admin', 'A', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin');

-- Add database indexes for performance
CREATE INDEX IF NOT EXISTS idx_chatbots_public_token ON chatbots (public_token);
CREATE INDEX IF NOT EXISTS idx_chatbots_created_by_id ON chatbots (created_by_id);

-- View the first user (to use as created_by_id)
SELECT id, username, role FROM users LIMIT 1;

-- Alternative chatbot creation for direct SQL access
-- Replace values as needed
INSERT INTO chatbots (name, slack_channel_id, created_by_id, public_token, is_active, require_auth)
VALUES 
('Test Project', 'C12345678', 1, 'abcdefghij', TRUE, FALSE);