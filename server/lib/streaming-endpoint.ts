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
  try {
    // Instead of redirecting, we'll use the streaming router directly
    const streamRouter = require('../routes/stream').default;
    
    // Manually call the router's handler instead of redirecting
    // to avoid "Cannot set headers after they are sent" error
    const route = streamRouter.stack[0].route;
    if (route && route.path === '/chatbots/:id/stream' && route.stack[0].handle) {
      return route.stack[0].handle(req, res);
    } else {
      throw new Error('Stream route not found');
    }
  } catch (error) {
    console.error('Error in handleStreamingEndpoint:', error);
    
    // Only set headers if they haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error in streaming endpoint' });
    }
  }
}