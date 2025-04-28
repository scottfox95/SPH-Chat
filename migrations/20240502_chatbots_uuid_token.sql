-- Create the UUID extension if it doesn't exist
create extension if not exists "uuid-ossp";

-- Alter the chatbots table to change public_token to UUID type with default
alter table chatbots
  alter column public_token drop default,
  alter column public_token type uuid using public_token::uuid,
  alter column public_token set default uuid_generate_v4();