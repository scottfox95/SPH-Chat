import { nanoid } from "nanoid";
import { pool } from "../db";
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique token for chatbot public identification
 * With improved error handling and fallback strategies
 * 
 * @returns Promise<string> A unique token for use as a public token
 */
export async function generatePublicToken(): Promise<string> {
  // First approach - try nanoid 
  for (let i = 0; i < 5; i++) {
    try {
      // Generate a token with 12 chars from nanoid
      const token = nanoid(12); 
      
      // Check if this token already exists
      const result = await pool.query(
        "SELECT 1 FROM chatbots WHERE public_token = $1 LIMIT 1",
        [token]
      );
      
      // If no rows found, we have a unique token
      if (result.rows.length === 0) {
        console.log(`Generated unique public token: ${token}`);
        return token;
      }
      
      console.log(`Token ${token} already exists, trying again`);
    } catch (error) {
      console.error(`Error checking token uniqueness with nanoid: ${error}`);
      // Try next approach if we can't check uniqueness
      break;
    }
  }
  
  // Second approach - try UUID V4 
  for (let i = 0; i < 3; i++) {
    try {
      // UUID v4 is guaranteed to be unique in distributed systems
      const token = uuidv4();
      
      // Check if this token already exists (just to be extra safe)
      const result = await pool.query(
        "SELECT 1 FROM chatbots WHERE public_token = $1 LIMIT 1",
        [token]
      );
      
      // If no rows found, we have a unique token
      if (result.rows.length === 0) {
        console.log(`Generated unique UUID token: ${token}`);
        return token;
      }
    } catch (error) {
      console.error(`Error checking UUID token uniqueness: ${error}`);
      // Just use a UUID without checking - extremely unlikely to have collision
      const fallbackToken = uuidv4();
      console.log(`Using unchecked UUID as fallback: ${fallbackToken}`);
      return fallbackToken;
    }
  }
  
  // Last resort - timestamp + random characters
  const timestamp = Date.now().toString(36);
  const randomChars = Math.random().toString(36).substring(2, 8);
  const lastResortToken = `${timestamp}_${randomChars}`;
  console.log(`Using last resort token: ${lastResortToken}`);
  return lastResortToken;
}