-- Migration to convert the public_token field in chatbots table from text to UUID
-- This ensures tokens are unique and prevents duplicate key errors

-- Step 1: Create a temp UUID column
ALTER TABLE chatbots ADD COLUMN temp_uuid UUID DEFAULT gen_random_uuid();

-- Step 2: Modify all queries that rely on public_token to use a temp UUID-like string
-- We'll create a function to convert existing tokens to UUID format in a consistent way

CREATE OR REPLACE FUNCTION convert_text_to_uuid(text_token TEXT) RETURNS UUID AS $$
DECLARE
  hash_input TEXT;
  md5_hash TEXT;
  uuid_str TEXT;
BEGIN
  -- Create a reproducible hash from the text token
  hash_input := text_token || 'sphchat-migration-salt';
  md5_hash := md5(hash_input);
  
  -- Format the MD5 hash as a UUID (8-4-4-4-12 format)
  uuid_str := substring(md5_hash, 1, 8) || '-' || 
              substring(md5_hash, 9, 4) || '-' || 
              substring(md5_hash, 13, 4) || '-' || 
              substring(md5_hash, 17, 4) || '-' || 
              substring(md5_hash, 21);
              
  RETURN uuid_str::UUID;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Update the temp UUID column with values derived from existing tokens
UPDATE chatbots SET temp_uuid = convert_text_to_uuid(public_token);

-- Step 4: Drop the public_token column and rename temp_uuid to public_token
ALTER TABLE chatbots DROP COLUMN public_token;
ALTER TABLE chatbots RENAME COLUMN temp_uuid TO public_token;

-- Step 5: Set constraints on the UUID column
ALTER TABLE chatbots ALTER COLUMN public_token SET NOT NULL;
ALTER TABLE chatbots ADD CONSTRAINT chatbots_public_token_unique UNIQUE (public_token);

-- Step 6: Clean up the conversion function
DROP FUNCTION convert_text_to_uuid(TEXT);