import OpenAI from 'openai';
import { storage } from '../storage';
import path from 'path';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Create or get a vector store for a chatbot
 */
export async function getOrCreateVectorStore(chatbotId: number, chatbotName: string): Promise<string> {
  // Check if chatbot already has a vector store
  const chatbot = await storage.getChatbot(chatbotId);
  if (chatbot?.vectorStoreId) {
    try {
      // Verify the vector store still exists
      const response = await fetch(`https://api.openai.com/v1/vector_stores/${chatbot.vectorStoreId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      if (response.ok) {
        return chatbot.vectorStoreId;
      }
      console.log(`Vector store ${chatbot.vectorStoreId} not found, creating new one`);
    } catch (error) {
      console.log(`Vector store ${chatbot.vectorStoreId} not found, creating new one`);
    }
  }

  // Create new vector store using direct API call
  const response = await fetch('https://api.openai.com/v1/vector_stores', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      name: `${chatbotName} Knowledge Base`
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create vector store: ${response.statusText}`);
  }

  const vectorStore = await response.json();

  // Update chatbot with vector store ID using SQL
  await storage.updateChatbot(chatbotId, { vectorStoreId: vectorStore.id } as any);

  console.log(`Created vector store ${vectorStore.id} for chatbot ${chatbotName}`);
  return vectorStore.id;
}

/**
 * Upload a file to OpenAI and add it to the chatbot's vector store
 */
export async function uploadFileToVectorStore(
  chatbotId: number, 
  documentId: number,
  filePath: string, 
  originalName: string
): Promise<{ fileId: string; vectorStoreId: string }> {
  
  const chatbot = await storage.getChatbot(chatbotId);
  if (!chatbot) {
    throw new Error(`Chatbot ${chatbotId} not found`);
  }

  // Get or create vector store
  const vectorStoreId = await getOrCreateVectorStore(chatbotId, chatbot.name);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Upload file to OpenAI
  const file = await openai.files.create({
    file: fs.createReadStream(filePath),
    purpose: 'assistants'
  });

  console.log(`Uploaded file ${originalName} to OpenAI with ID: ${file.id}`);

  // Add file to vector store using direct API call
  const addFileResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      file_id: file.id
    })
  });

  if (!addFileResponse.ok) {
    throw new Error(`Failed to add file to vector store: ${addFileResponse.statusText}`);
  }

  console.log(`Added file ${file.id} to vector store ${vectorStoreId}`);

  // Update document record with OpenAI file ID and vector store ID
  await storage.updateDocument(documentId, {
    openaiFileId: file.id,
    vectorStoreId: vectorStoreId
  });

  return { fileId: file.id, vectorStoreId };
}

/**
 * Remove a file from OpenAI vector store
 */
export async function removeFileFromVectorStore(documentId: number): Promise<void> {
  const document = await storage.getDocument(documentId);
  if (!document || !document.openaiFileId || !document.vectorStoreId) {
    console.log(`Document ${documentId} has no OpenAI file ID or vector store ID`);
    return;
  }

  try {
    // Remove from vector store using direct API call
    const removeResponse = await fetch(`https://api.openai.com/v1/vector_stores/${document.vectorStoreId}/files/${document.openaiFileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (removeResponse.ok) {
      console.log(`Removed file ${document.openaiFileId} from vector store ${document.vectorStoreId}`);
    }

    // Delete the file from OpenAI
    await openai.files.del(document.openaiFileId);
    console.log(`Deleted file ${document.openaiFileId} from OpenAI`);

    // Clear the OpenAI IDs from document record
    await storage.updateDocument(documentId, {
      openaiFileId: null,
      vectorStoreId: null
    });
  } catch (error) {
    console.error(`Error removing file from vector store:`, error);
    // Still clear the IDs even if deletion failed
    await storage.updateDocument(documentId, {
      openaiFileId: null,
      vectorStoreId: null
    });
  }
}

/**
 * Get chatbot response using vector store with file_search tool
 */
export async function getChatbotResponseWithVectorStore(
  prompt: string,
  chatbotId: number,
  slackMessages: any[],
  systemPrompt: string,
  outputFormat?: string | null
): Promise<string> {
  try {
    const chatbot = await storage.getChatbot(chatbotId);
    if (!chatbot) {
      throw new Error(`Chatbot ${chatbotId} not found`);
    }

    // Get application settings to determine model
    const settings = await storage.getSettings();
    let model = settings?.openaiModel || "gpt-4o";

    // Convert legacy model name format for Responses API
    if (model.startsWith("gpt-")) {
      if (model === "gpt-4o") model = "o4";
      else if (model === "gpt-4o-mini") model = "o4-mini";
    }

    console.log(`Using OpenAI model: ${model}`);

    // Prepare Slack messages for context
    const formattedSlackMessages = slackMessages.filter(msg => {
      return typeof msg !== 'string';
    }).map(msg => {
      let messagePrefix = "SLACK MESSAGE";
      
      if (settings?.includeSourceDetails) {
        if (settings?.includeUserInSource && msg.meta?.user) {
          messagePrefix += ` FROM: ${msg.meta.user}`;
        }
        
        if (settings?.includeDateInSource && msg.meta?.formattedDate) {
          messagePrefix += ` DATE: ${msg.meta.formattedDate}`;
        }
      }
      
      return `${messagePrefix}: ${msg.meta?.rawMessage || msg.text}`;
    });

    // Build the full context
    let context = "";
    if (formattedSlackMessages.length > 0) {
      context += "SLACK CHANNEL HISTORY:\n" + formattedSlackMessages.join("\n\n") + "\n\n";
    }

    // Combine system prompt with output format if specified
    let fullSystemPrompt = systemPrompt;
    if (outputFormat) {
      fullSystemPrompt += `\n\nOUTPUT FORMAT: Please format your response exactly as follows:\n${outputFormat}`;
    }

    // Prepare the full prompt with context
    const fullPrompt = context + "USER QUESTION: " + prompt;

    console.log(`Making OpenAI Responses API request with vector store`);
    console.log(`System prompt length: ${fullSystemPrompt.length}, Full prompt length: ${fullPrompt.length}`);

    // Create request parameters with vector store if available
    const requestParams: any = {
      model,
      instructions: fullSystemPrompt,
      input: fullPrompt,
      max_output_tokens: 4000
    };

    // Add file_search tool if chatbot has a vector store
    // Note: The Responses API format
    if (chatbot.vectorStoreId) {
      requestParams.tools = [{ 
        type: "file_search",
        vector_store_ids: [chatbot.vectorStoreId]
      }];
      console.log(`Using vector store ${chatbot.vectorStoreId} for file search`);
    }

    // Add temperature if supported by model
    if (model !== "o1" && !model.includes("-preview") && !model.includes("o4-mini") && !model.includes("4.1-mini")) {
      requestParams.temperature = 0.7;
    }

    console.log(`DEBUG - Final request parameters for vector store response:`);
    console.log(JSON.stringify(requestParams, null, 2));

    const startTime = Date.now();
    const response = await openai.responses.create(requestParams);
    const endTime = Date.now();

    console.log(`OpenAI API request completed in ${endTime - startTime}ms`);

    // Extract text content from response
    const extractedText = extractTextFromResponseOutput(response.output);
    console.log(`Response received with ${extractedText?.length || 0} characters`);

    return extractedText || "I apologize, but I couldn't generate a response. Please try again.";

  } catch (error: any) {
    console.error("OpenAI API error in vector store response:", error);
    
    if (error?.response?.data?.error?.message) {
      return `Error: ${error.response.data.error.message}`;
    }
    
    return "I apologize, but I encountered an error processing your request. Please try again.";
  }
}

/**
 * Helper function to extract text from OpenAI response output
 */
function extractTextFromResponseOutput(output: any): string | null {
  try {
    if (!output) return null;
    
    if (Array.isArray(output)) {
      for (const item of output) {
        if (item.type === 'message' && item.content && Array.isArray(item.content)) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              return contentItem.text;
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting text from response output:", error);
    return null;
  }
}