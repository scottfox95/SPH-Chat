import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { storage } from "../storage";

// Initialize OpenAI client with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Stream chat completions from OpenAI directly to the client
 * This implements true token-by-token streaming
 */
export async function streamChatCompletion(
  req: any,
  res: any,
  messages: ChatCompletionMessageParam[],
  model: string = "gpt-4o",
  chatbotId?: number
): Promise<void> {
  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  
  try {
    console.log(`Starting OpenAI chat stream with model: ${model}`);
    
    // Create the streaming request to OpenAI
    const stream = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      stream: true,
    });
    
    // Track full response for logging
    let fullResponse = '';
    
    // Process the stream
    for await (const chunk of stream) {
      // Extract the token from the delta
      const token = chunk.choices[0]?.delta?.content || '';
      
      if (token) {
        // Add to the full response
        fullResponse += token;
        
        // Send the token as an SSE event
        res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
      }
    }
    
    console.log(`Streaming complete, full response length: ${fullResponse.length}`);
    
    // Save the response to the database if chatbotId is provided
    let messageId;
    if (chatbotId) {
      try {
        // Extract citation if it exists
        let citation = "";
        const citationRegex = /\[(?:From |Source: |Slack(?: message)?,? )?(.*?)\]/;
        const match = fullResponse?.match(citationRegex);
        if (match && match[1]) {
          citation = match[1];
        }
        
        // Save response to database
        const savedMessage = await storage.createMessage({
          chatbotId,
          userId: null,
          content: fullResponse,
          isUserMessage: false,
          citation: citation,
        });
        
        messageId = savedMessage.id;
        console.log(`Saved AI response to database with ID: ${messageId}`);
      } catch (dbError) {
        console.error("Error saving response to database:", dbError);
      }
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({ done: true, messageId })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error in streaming chat completion:", error);
    
    // Send error event
    res.write(`data: ${JSON.stringify({ error: "Error generating response" })}\n\n`);
    res.end();
  }
}

/**
 * Get a chat completion without streaming
 */
export async function getChatCompletion(
  messages: ChatCompletionMessageParam[],
  model: string = "gpt-4o"
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
    });
    
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error("Error in chat completion:", error);
    throw error;
  }
}