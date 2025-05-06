import { storage } from "../storage";
import { processDocument } from "./document-processor";
import { getFormattedSlackMessages, validateSlackChannel } from "./slack";
import path from "path";

// In-memory storage for document content
const documentContentCache = new Map<number, string[]>();

/**
 * Gets documents for a chatbot from storage and processes them
 * @param chatbotId The ID of the chatbot
 * @param forceRefresh Whether to force a refresh of the cache
 * @returns Array of processed document content
 */
export async function getProcessedDocuments(chatbotId: number, forceRefresh: boolean = false): Promise<string[]> {
  try {
    console.log(`getProcessedDocuments called for chatbot ${chatbotId}, forceRefresh=${forceRefresh}`);
    
    // Check cache first if we're not forcing a refresh
    if (!forceRefresh && documentContentCache.has(chatbotId)) {
      const cachedContent = documentContentCache.get(chatbotId) || [];
      console.log(`Using cached documents for chatbot ${chatbotId}. Cache has ${cachedContent.length} document chunks`);
      
      // Additional validation that cache actually contains useful content
      const nonErrorContent = cachedContent.filter(item => !item.includes("Error processing") && !item.includes("No content could be extracted"));
      
      if (nonErrorContent.length === 0 && cachedContent.length > 0) {
        console.warn(`Cache only contains error messages for chatbot ${chatbotId}, forcing refresh`);
        // Continue to refresh cache as it only contains errors
      } else if (cachedContent.length > 0) {
        return cachedContent;
      }
    }
    
    // Get documents from storage
    console.log(`${forceRefresh ? 'Force refreshing' : 'No valid cache found'}. Fetching documents for chatbot ${chatbotId} from database`);
    const documents = await storage.getDocuments(chatbotId);
    console.log(`Found ${documents.length} documents in database for chatbot ${chatbotId}`);
    
    // Process each document
    const processedContent: string[] = [];
    const processingErrors: string[] = [];
    
    for (const doc of documents) {
      console.log(`Processing document: ${doc.originalName} (ID: ${doc.id}) with type ${doc.fileType}`);
      const filePath = path.join(process.cwd(), "uploads", doc.filename);
      console.log(`Full file path: ${filePath}`);
      
      try {
        const content = await processDocument(filePath, doc.fileType);
        console.log(`Document ${doc.originalName} processed with ${content.length} content chunks`);
        
        // Check if this document only returned error messages
        const onlyErrors = content.every(chunk => 
          chunk.includes("could not be processed") || 
          chunk.includes("no text content could be extracted") ||
          chunk.includes("has an unsupported format")
        );
        
        if (onlyErrors) {
          console.warn(`Document ${doc.originalName} only produced error messages`);
          processingErrors.push(`Document ${doc.originalName} processing failed: ${content[0]}`);
        }
        
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
        const errorMessage = docError instanceof Error ? docError.message : 'Unknown error';
        console.error(`Error processing individual document ${doc.originalName}: ${errorMessage}`);
        processingErrors.push(`Error processing ${doc.originalName}: ${errorMessage}`);
        processedContent.push(`[From ${doc.originalName}] Error processing this document: ${errorMessage}`);
      }
    }
    
    console.log(`Total processed document chunks for chatbot ${chatbotId}: ${processedContent.length}`);
    if (processingErrors.length > 0) {
      console.warn(`Encountered ${processingErrors.length} document processing errors:`);
      processingErrors.forEach((err, i) => {
        if (i < 5) console.warn(`- ${err}`);
      });
      if (processingErrors.length > 5) {
        console.warn(`... and ${processingErrors.length - 5} more errors`);
      }
    }
    
    // Cache the results
    documentContentCache.set(chatbotId, processedContent);
    
    return processedContent;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error in getProcessedDocuments for chatbot ${chatbotId}: ${errorMessage}`);
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
    
    // Get processed documents - force refresh to ensure we have the latest data
    const documents = await getProcessedDocuments(chatbotId, true);
    
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
