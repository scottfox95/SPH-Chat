import crypto from "crypto";
import { pool } from "../db";

/**
 * Generates a unique UUID token for chatbot public identification
 * Verifies it doesn't already exist in the database to avoid conflicts
 * 
 * @returns Promise<string> A unique UUID for use as a public token
 * @throws Error if unable to generate a unique token after multiple attempts
 */
export async function generatePublicToken(): Promise<string> {
  for (let i = 0; i < 5; i++) {  // 5 tries ≈ 1-in-10¹⁰ chance of failure
    const token = crypto.randomUUID(); // RFC-4122 v4 UUID, 36-char string
    const result = await pool.query(
      "SELECT 1 FROM chatbots WHERE public_token = $1 LIMIT 1",
      [token]
    );
    if (result.rows.length === 0) return token;
  }
  throw new Error("Could not generate a unique public token after 5 attempts");
}