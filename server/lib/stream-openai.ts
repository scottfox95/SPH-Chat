import OpenAI from "openai";
import { storage } from "../storage";

// Initialize OpenAI client with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Handle SSE streaming from OpenAI to the client
 * Using the OpenAI Responses API directly
 */
export async function handleOpenAIStream(req: any, res: any, messages: any[], model: string = "gpt-4o") {
  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.socket?.setTimeout(0); // Prevent timeout
  res.flushHeaders?.();

  try {
    console.log(`Starting OpenAI stream with model: ${model}`);
    
    // Create the streaming request to OpenAI Responses API
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
        res.write(`data: ${token}\n\n`);
      }
    }
    
    console.log(`Streaming complete, full response length: ${fullResponse.length}`);
    
    // Return the full response for further processing (e.g., database storage)
    return fullResponse;
  } catch (error) {
    console.error("Error in streaming OpenAI:", error);
    
    // Send error via SSE
    res.write(`event: error\ndata: ${JSON.stringify({ error: "Error generating response" })}\n\n`);
    res.end();
    
    throw error; // Re-throw to allow calling code to handle it
  }
}

/**
 * Get a chat completion without streaming
 * For consistency with streaming function
 */
export async function getChatCompletion(messages: any[], model: string = "gpt-4o") {
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