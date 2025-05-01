#!/bin/bash

# Script to run the email settings migration
# This adds email settings columns to the settings table

# Set the database connection parameters
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable not set"
  exit 1
fi

# Log the start time
echo "Starting email settings migration at $(date)"

# Run the migration SQL file
echo "Running migration to add email settings columns to the settings table..."
psql "$DATABASE_URL" -f migrations/20240502_add_email_settings.sql

# Check if the migration was successful
if [ $? -eq 0 ]; then
  echo "Migration completed successfully!"
  echo "Email settings columns have been added to the settings table."
else
  echo "Migration failed with error code $?"
  echo "Please check the database logs for more details."
  exit 1
fi

echo "Migration completed at $(date)"