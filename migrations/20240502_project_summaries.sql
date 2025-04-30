-- Create project_summaries table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_summaries (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  week TEXT NOT NULL,
  slack_channel_id TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create project_email_recipients table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_email_recipients (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  email TEXT NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS project_summaries_project_id_idx ON project_summaries (project_id);
CREATE INDEX IF NOT EXISTS project_email_recipients_project_id_idx ON project_email_recipients (project_id);