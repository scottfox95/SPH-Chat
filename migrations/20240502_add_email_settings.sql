-- Add email settings columns to the settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_port TEXT DEFAULT '587';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_pass TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_from TEXT;