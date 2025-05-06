import OpenAI from "openai";

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
  messages: { role: string, content: string }[],
  model: string = "gpt-4o"
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
    
    // Send completion event
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
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
  messages: { role: string, content: string }[],
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