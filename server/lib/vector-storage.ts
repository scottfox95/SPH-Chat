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
    console.log(`getProcessedDocuments called for chatbot ${chatbotId}`);
    
    // Check cache first
    if (documentContentCache.has(chatbotId)) {
      console.log(`Using cached documents for chatbot ${chatbotId}. Cache has ${documentContentCache.get(chatbotId)?.length || 0} document chunks`);
      return documentContentCache.get(chatbotId) || [];
    }
    
    // Get documents from storage
    console.log(`No cache found. Fetching documents for chatbot ${chatbotId} from database`);
    const documents = await storage.getDocuments(chatbotId);
    console.log(`Found ${documents.length} documents in database for chatbot ${chatbotId}`);
    
    // Process each document
    const processedContent: string[] = [];
    
    for (const doc of documents) {
      console.log(`Processing document: ${doc.originalName} (ID: ${doc.id}) with type ${doc.fileType}`);
      const filePath = path.join(process.cwd(), "uploads", doc.filename);
      console.log(`Full file path: ${filePath}`);
      
      try {
        const content = await processDocument(filePath, doc.fileType);
        console.log(`Document ${doc.originalName} processed with ${content.length} content chunks`);
        
        if (content.length === 0) {
          console.warn(`Document ${doc.originalName} processed but returned no content`);
          processedContent.push(`[From ${doc.originalName}] No content could be extracted from this document.`);
          continue;
        }
        
        const formattedContent = content.map(text => {
          return `[From ${doc.originalName}] ${text}`;
        });
        
        processedContent.push(...formattedContent);
      } catch (docError) {
        console.error(`Error processing individual document ${doc.originalName}:`, docError);
        processedContent.push(`[From ${doc.originalName}] Error processing this document.`);
      }
    }
    
    console.log(`Total processed document chunks for chatbot ${chatbotId}: ${processedContent.length}`);
    
    // Cache the results
    documentContentCache.set(chatbotId, processedContent);
    
    return processedContent;
  } catch (error) {
    console.error(`Error in getProcessedDocuments for chatbot ${chatbotId}:`, error);
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
 * Clears the document cache for a specific chatbot
 * @param chatbotId The ID of the chatbot
 */
export function clearDocumentCache(chatbotId: number): void {
  documentContentCache.delete(chatbotId);
  console.log(`Document cache cleared for chatbot ${chatbotId}`);
}

/**
 * Clears the entire document cache
 * Useful when documents are added/deleted from the global knowledge base view
 */
export function clearAllDocumentCache(): void {
  documentContentCache.clear();
  console.log("All document caches cleared");
}
