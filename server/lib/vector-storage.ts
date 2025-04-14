import { storage } from "../storage";
import { processDocument } from "./document-processor";
import { getFormattedSlackMessages, validateSlackChannel } from "./slack";
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
 * @returns Object containing documents and messages
 */
export async function getChatbotContext(chatbotId: number, query?: string): Promise<{
  documents: string[];
  slackMessages: string[];
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
    let slackMessages: string[] = [];
    const channelValidation = await validateSlackChannel(chatbot.slackChannelId);
    
    if (channelValidation.valid) {
      // Get Slack messages only if the channel is valid
      slackMessages = await getFormattedSlackMessages(chatbot.slackChannelId);
    } else {
      console.warn(`Cannot retrieve Slack messages for channel ${chatbot.slackChannelId}: ${channelValidation.error}`);
    }
    
    return {
      documents,
      slackMessages,
    };
  } catch (error) {
    console.error("Error getting chatbot context:", error);
    return {
      documents: [],
      slackMessages: [],
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
