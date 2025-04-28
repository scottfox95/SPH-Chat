import { nanoid } from "nanoid";
import { pool } from "../db";
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Generates a truly unique token for chatbot public identification
 * This function ensures tokens are unique across environments (dev/prod)
 * by using cryptographically secure methods and environment markers.
 * 
 * @returns Promise<string> A unique token for use as a public token
 */
export async function generatePublicToken(): Promise<string> {
  // Create an environment prefix to ensure uniqueness across environments
  const envPrefix = process.env.NODE_ENV === 'production' ? 'p' : 'd';
  
  // Get a timestamp component for uniqueness
  const timestamp = Date.now().toString(36).slice(-4);
  
  // First approach - try with crypto random values (most secure)
  for (let i = 0; i < 3; i++) {
    try {
      // Generate cryptographically secure random bytes
      const randomBytes = crypto.randomBytes(8).toString('base64url').slice(0, 8);
      
      // Combine all components into a token
      const token = `${envPrefix}${timestamp}${randomBytes}`;
      
      // Check if this token already exists in the database
      const result = await pool.query(
        "SELECT 1 FROM chatbots WHERE public_token = $1 LIMIT 1",
        [token]
      );
      
      // If no rows found, we have a unique token
      if (result.rows.length === 0) {
        console.log(`Generated cryptographically secure token: ${token}`);
        return token;
      }
      
      console.log(`Token ${token} already exists (very unlikely), trying again`);
    } catch (error) {
      console.error(`Error generating/checking secure token: ${error}`);
      // Try next approach if we can't generate/check
      break;
    }
  }
  
  // Second approach - use nanoid with environment markers 
  for (let i = 0; i < 3; i++) {
    try {
      // Generate a token with nanoid and prepend environment marker
      const nanoidPart = nanoid(10);
      const token = `${envPrefix}${timestamp}${nanoidPart}`;
      
      // Check if this token already exists
      const result = await pool.query(
        "SELECT 1 FROM chatbots WHERE public_token = $1 LIMIT 1",
        [token]
      );
      
      // If no rows found, we have a unique token
      if (result.rows.length === 0) {
        console.log(`Generated unique nanoid token: ${token}`);
        return token;
      }
    } catch (error) {
      console.error(`Error with nanoid token: ${error}`);
      break;
    }
  }
  
  // Last resort - use UUID with environment prefix
  // UUID v4 is designed to be globally unique, so collision is extremely unlikely
  const uuid = uuidv4().replace(/-/g, '').slice(0, 12);
  const lastResortToken = `${envPrefix}${timestamp}${uuid}`;
  
  // Perform one final uniqueness check if possible
  try {
    const result = await pool.query(
      "SELECT 1 FROM chatbots WHERE public_token = $1 LIMIT 1",
      [lastResortToken]
    );
    
    if (result.rows.length > 0) {
      // In the extremely unlikely case of collision, add more randomness
      const extraRandom = crypto.randomBytes(4).toString('hex');
      return `${envPrefix}${timestamp}${uuid}${extraRandom}`;
    }
  } catch (error) {
    // If we can't check, the UUID is still extremely unlikely to collide
    console.error(`Final uniqueness check failed, using token anyway: ${error}`);
  }
  
  console.log(`Using environment-prefixed UUID token: ${lastResortToken}`);
  return lastResortToken;
}