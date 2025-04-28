#!/bin/bash

# Script to run the UUID migration for the chatbots table
# This converts the public_token field from TEXT to UUID type

# Set the database connection parameters
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable not set"
  exit 1
fi

# Log the start time
echo "Starting migration at $(date)"

# Run the migration SQL file
echo "Running migration to convert chatbots.public_token to UUID type..."
psql "$DATABASE_URL" -f migrations/20240502_chatbots_uuid_token.sql

# Check if the migration was successful
if [ $? -eq 0 ]; then
  echo "Migration completed successfully!"
  echo "All chatbot tokens have been converted to UUID format."
  echo "The schema has been updated to use UUID type with automatic generation."
else
  echo "Migration failed with error code $?"
  echo "Please check the database logs for more details."
  exit 1
fi

echo "Migration completed at $(date)"