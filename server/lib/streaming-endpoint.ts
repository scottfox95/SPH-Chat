import { Request, Response } from "express";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { storage } from "../storage";
import { getChatbotContext } from "../lib/vector-storage";
import { formatTasksForChatbot, getAsanaProjectTasks } from "../lib/asana";

// Initialize OpenAI client with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Handler for streaming endpoint that can be used in routes.ts
 */
export async function handleStreamingEndpoint(req: Request, res: Response): Promise<void> {
  // Forward to our streaming endpoint in routes/stream.ts
  // This is just a compatibility layer to keep the existing code structure
  res.redirect(307, `/api${req.path}`);
}