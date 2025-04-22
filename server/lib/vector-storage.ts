import { storage } from "../storage";
import { processDocument } from "./document-processor";
import { getFormattedSlackMessages, validateSlackChannel } from "./slack";
import { getAsanaProjectTasks, formatAsanaTasksForContext, testAsanaConnection } from "./asana";
import path from "path";

// In-memory storage for document content
const documentContentCache = new Map<number, string[]>();

/**
 * Gets documents for a chatbot from storage and processes them
 * @param chatbotId The ID of the chatbot
 * @returns Array of processed document content
 */
export async function getProcessedDocuments(chatbotId: number): Promise<string[]> {
  try {
    // Check cache first
    if (documentContentCache.has(chatbotId)) {
      return documentContentCache.get(chatbotId) || [];
    }
    
    // Get documents from storage
    const documents = await storage.getDocuments(chatbotId);
    
    // Process each document
    const processedContent: string[] = [];
    
    for (const doc of documents) {
      const filePath = path.join(process.cwd(), "uploads", doc.filename);
      const content = await processDocument(filePath, doc.fileType);
      
      const formattedContent = content.map(text => {
        return `[From ${doc.originalName}] ${text}`;
      });
      
      processedContent.push(...formattedContent);
    }
    
    // Cache the results
    documentContentCache.set(chatbotId, processedContent);
    
    return processedContent;
  } catch (error) {
    console.error("Error processing documents:", error);
    return [];
  }
}

/**
 * Gets relevant documents and Slack messages for a chatbot
 * @param chatbotId The ID of the chatbot
 * @param query Optional query to filter results (not implemented in MVP)
 * @returns Object containing documents and messages with metadata
 */
export async function getChatbotContext(chatbotId: number, query?: string): Promise<{
  documents: string[];
  slackMessages: any[];
  asanaTasks: string[];
}> {
  try {
    // Get chatbot
    const chatbot = await storage.getChatbot(chatbotId);
    
    if (!chatbot) {
      throw new Error(`Chatbot not found: ${chatbotId}`);
    }
    
    // Get processed documents
    const documents = await getProcessedDocuments(chatbotId);
    
    // Validate Slack channel before trying to get messages
    let slackMessages: any[] = [];
    const channelValidation = await validateSlackChannel(chatbot.slackChannelId);
    
    if (channelValidation.valid) {
      // Get Slack messages only if the channel is valid
      const formattedMessages = await getFormattedSlackMessages(chatbot.slackChannelId);
      
      // Keep the full message objects with metadata for use in response generation
      slackMessages = formattedMessages;
    } else {
      console.warn(`Cannot retrieve Slack messages for channel ${chatbot.slackChannelId}: ${channelValidation.error}`);
    }
    
    // Get Asana tasks if connection is configured
    let asanaTasks: string[] = [];
    if (chatbot.asanaConnectionId && chatbot.asanaProjectId) {
      try {
        // Check if Asana connection is valid
        const connectionValid = await testAsanaConnection(chatbot.asanaConnectionId);
        
        if (connectionValid.valid) {
          // Get tasks from Asana and format them
          const tasks = await getAsanaProjectTasks(
            chatbot.asanaConnectionId, 
            chatbot.asanaProjectId
          );
          
          asanaTasks = formatAsanaTasksForContext(tasks);
        } else {
          console.warn(`Cannot retrieve Asana tasks: ${connectionValid.message}`);
        }
      } catch (asanaError) {
        console.error("Error fetching Asana tasks:", asanaError);
      }
    }
    
    return {
      documents,
      slackMessages,
      asanaTasks,
    };
  } catch (error) {
    console.error("Error getting chatbot context:", error);
    return {
      documents: [],
      slackMessages: [],
      asanaTasks: [],
    };
  }
}

/**
 * Clears the document cache for a chatbot
 * @param chatbotId The ID of the chatbot
 */
export function clearDocumentCache(chatbotId: number): void {
  documentContentCache.delete(chatbotId);
}
