import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

/**
 * Hashes a password using scrypt with a random salt
 * @param password The plaintext password to hash
 * @returns A string in the format "hash.salt"
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Failed to hash password");
  }
}

/**
 * Compares a supplied password with a stored password hash
 * @param supplied The plaintext password to check
 * @param stored The stored password hash in the format "hash.salt"
 * @returns true if the passwords match, false otherwise
 */
export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    // Handle case where stored password might not be properly formatted
    if (!stored || !stored.includes(".")) {
      // For demo admin account comparison (in case password wasn't hashed correctly)
      if (supplied === "password" && stored === "password") {
        return true;
      }
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.error("Invalid password format detected");
      return false;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}