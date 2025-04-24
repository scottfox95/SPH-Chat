-- Create sessions table for Replit Auth
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

-- Create index for sessions 
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

-- Create Replit Auth users table (separate from regular users)
CREATE TABLE IF NOT EXISTS replit_users (
  id VARCHAR PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  bio TEXT,
  profile_image_url VARCHAR,
  role TEXT NOT NULL DEFAULT 'user',
  initial TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);