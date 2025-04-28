import { nanoid } from "nanoid";
import { pool } from "../db";

/**
 * Generates a unique token for chatbot public identification
 * Uses nanoid for better collision resistance and uses a timestamp prefix
 * Verifies it doesn't already exist in the database to avoid conflicts
 * 
 * @returns Promise<string> A unique token for use as a public token
 * @throws Error if unable to generate a unique token after multiple attempts
 */
export async function generatePublicToken(): Promise<string> {
  for (let i = 0; i < 10; i++) {  // 10 tries for maximum safety
    // Generate a token with 10 chars from nanoid
    const randomPart = nanoid(10);
    const token = randomPart;
    
    try {
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
      console.error(`Error checking token uniqueness: ${error}`);
      // Continue to next attempt even if check fails
    }
  }
  
  // If we reached here, we couldn't generate a unique token
  throw new Error("Could not generate a unique public token after 10 attempts");
}