import OpenAI from "openai";
import { storage } from "../storage";
import { Settings } from "@shared/schema";

// Initialize OpenAI client with the API key from environment variables
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper to get the settings
async function getSettings(): Promise<Settings | null> {
  try {
    const settings = await storage.getSettings();
    return settings || null;
  } catch (error) {
    console.error("Error getting settings:", error);
    return null;
  }
}

// Helper to get the current model from settings
async function getCurrentModel(): Promise<string> {
  const settings = await getSettings();
  return settings?.openaiModel || "gpt-4o";
}

// Function to get chatbot response
export async function getChatbotResponse(
  prompt: string,
  documents: string[],
  slackMessages: any[],
  systemPrompt: string,
  outputFormat?: string | null
) {
  try {
    console.log(`getChatbotResponse called with prompt: "${prompt.substring(0, 50)}..."`);
    console.log(`Documents count: ${documents.length}, Slack/Asana messages count: ${slackMessages.length}`);
    
    // Get application settings to determine source attribution behavior
    const settings = await getSettings();
    
    // Prepare Slack messages for the context
    // Include metadata for proper attribution in a format OpenAI can understand
    const formattedSlackMessages = slackMessages.filter(msg => {
      // Filter out any items that are actually Asana task strings (not objects with meta property)
      return typeof msg !== 'string';
    }).map(msg => {
      // Include attribution data in a structured way that OpenAI can extract
      let messagePrefix = "SLACK MESSAGE";
      
      // Add attribution data if source details are enabled
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
    
    console.log(`Formatted ${formattedSlackMessages.length} Slack messages for context`);
    
    // Extract Asana tasks (these were passed as strings)
    const asanaTasks = slackMessages.filter(msg => typeof msg === 'string');
    console.log(`Found ${asanaTasks.length} Asana tasks for context`);
    
    // Context for the model - add more detailed document validation
    // First filter out error messages being sent as context, but keep better track of what's happening
    const errorDocuments = documents.filter(doc => doc.includes("Error processing"));
    const validDocuments = documents.filter(doc => !doc.includes("Error processing"));
    
    if (errorDocuments.length > 0) {
      console.log(`WARNING: Found ${errorDocuments.length} document processing errors that will be excluded from context`);
      errorDocuments.forEach((errDoc, i) => {
        if (i < 3) console.log(`Error document ${i+1}: ${errDoc}`);
      });
    }
    
    console.log(`Found ${documents.length} total document chunks, ${validDocuments.length} valid (non-error) chunks`);
    
    // Count how many sheets/pages of content we have from different file types
    const excelSheetCount = validDocuments.filter(doc => doc.includes("[Excel Sheet:")).length;
    const pdfPageCount = validDocuments.filter(doc => doc.includes("[PDF Page")).length;
    const textFileCount = validDocuments.filter(doc => doc.includes("[Text File")).length;
    
    console.log(`Document type breakdown: ${excelSheetCount} Excel sheets, ${pdfPageCount} PDF pages, ${textFileCount} text files`);
    
    // Analyze if we have actual content in our documents (not just headers)
    documents.forEach((doc, index) => {
      // Look at a sample of documents to avoid excessive logging
      if (index < 5) {
        const contentLength = doc.length;
        const contentSample = doc.substring(0, Math.min(100, contentLength));
        console.log(`Document ${index+1} type: ${
          doc.includes("[Excel Sheet:") ? "Excel" :
          doc.includes("[PDF Page") ? "PDF" :
          doc.includes("[Text File") ? "Text" : "Unknown"
        }, length: ${contentLength} chars, sample: ${contentSample}...`);
      }
    });
    
    // Change document prefixing to make content more prominent
    const documentContext = validDocuments.map((doc) => {
      if (doc.includes("[Excel Sheet:")) {
        // Keep the sheet name but highlight it's a spreadsheet
        return `SPREADSHEET DATA: ${doc}`;
      } else if (doc.includes("[PDF Page")) {
        return `PROJECT DOCUMENT: ${doc}`;
      } else {
        return `DOCUMENT DATA: ${doc}`;
      }
    });
    
    console.log(`Adding ${documentContext.length} valid document chunks to context`);
    
    const context = [
      ...documentContext,
      ...formattedSlackMessages,
      ...asanaTasks.map(task => `ASANA TASK DATA: ${task}`)
    ].join("\n\n");
    
    // Log the total size of context (truncate for log clarity)
    const contextSize = context.length;
    console.log(`Total context size: ${contextSize} characters`);
    if (contextSize > 0) {
      console.log(`Context preview: ${context.substring(0, 200)}...`);
      
      // Do some additional validation on context
      if (documentContext.length > 0) {
        // Check if the first document has good content
        const firstDocumentSample = documentContext[0].substring(0, 200);
        console.log(`First document in context: ${firstDocumentSample}...`);
      } else {
        console.warn(`No valid documents in context! Only messages will be used. This may indicate a problem with document processing or database retrieval.`);
      }
    } else {
      console.warn(`No context provided to the model! This will result in generic responses. Troubleshooting steps:
      1. Check if documents exist in the database for this chatbot
      2. Verify the document processing is working correctly
      3. Make sure document cache is properly invalidated when new documents are added
      4. Check if any errors occurred during document processing`);
    }

    // Enhance the system prompt with instructions about including source information
    let enhancedSystemPrompt = systemPrompt;
    
    if (settings?.includeSourceDetails) {
      enhancedSystemPrompt += "\n\nIMPORTANT: You MUST provide source attribution whenever you use information from Slack messages. This is critical for users to trust the information. ";
      
      if (settings?.includeUserInSource && settings?.includeDateInSource) {
        enhancedSystemPrompt += "ALWAYS include BOTH the name of the person who sent the message AND the date/time when responding.";
      } else if (settings?.includeUserInSource) {
        enhancedSystemPrompt += "ALWAYS include the name of the person who sent the message when responding.";
      } else if (settings?.includeDateInSource) {
        enhancedSystemPrompt += "ALWAYS include the date and time when the message was sent when responding.";
      }
      
      enhancedSystemPrompt += " Format source attribution at the end of your response like this: 'according to [NAME] on [DATE]' or similar natural phrasing. Never skip this attribution part even if the information seems unimportant.";
    }

    // Append output format instructions if provided
    const messages = [
      {
        role: "system" as const,
        content: enhancedSystemPrompt,
      },
      {
        role: "user" as const,
        content: `I need information about the following: ${prompt}\n\nHere's all the context I have:\n${context}`,
      }
    ];

    // Add a dedicated formatting message if outputFormat is specified
    if (outputFormat) {
      messages.push({
        role: "system" as const,
        content: `IMPORTANT - OUTPUT FORMAT: Your response MUST follow this exact format:\n${outputFormat}\n\nYou MUST put each expense entry on its own line with a line break (\\n) between entries. Each line must follow the format exactly. Do not deviate from this format in any way.`
      });
    }

    // Get the model from settings
    let model = await getCurrentModel();
    
    // Convert o4-mini to the correct format for the OpenAI API
    // OpenAI's Assistants/Responses API uses "o4-mini" but Chat Completions uses "gpt-4o-mini"
    if (model === "o4-mini") {
      // We're using chat completions API which requires the gpt- prefix
      model = "gpt-4o-mini";
    }
    
    console.log(`Using OpenAI model: ${model}`);
    
    console.log(`Making request to OpenAI API with ${messages.length} messages`);
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model, // Use model from settings with proper formatting for the API
      messages,
      temperature: 0.3,
    });
    const endTime = Date.now();
    console.log(`OpenAI API request completed in ${endTime - startTime}ms`);

    const responseText = response.choices[0].message.content;
    console.log(`Response received with ${responseText?.length || 0} characters`);
    
    // Parse the citation if it exists
    let citation = "";
    const citationRegex = /\[(?:From |Source: |Slack(?: message)?,? )?(.*?)\]/;
    const match = responseText?.match(citationRegex);
    
    if (match && match[1]) {
      citation = match[1];
      console.log(`Citation found in standard format: ${citation}`);
    } else if (settings?.includeSourceDetails) {
      // Try to extract source details from the response text using patterns like "according to X on Y"
      const sourceRegex = /according to ([^\.]+)/i;
      const sourceMatch = responseText?.match(sourceRegex);
      if (sourceMatch && sourceMatch[1]) {
        citation = sourceMatch[1].trim();
        console.log(`Citation found in "according to" format: ${citation}`);
      } else {
        console.log(`No citation pattern found in response`);
      }
    }
    
    let finalContent = responseText || "I wasn't able to find that information in the project files or Slack messages.";
    
    // Only strip the citation if it's in the standard bracket format
    if (match && match[0]) {
      finalContent = finalContent.replace(citationRegex, "").trim();
    }
    
    console.log(`Returning response with content length: ${finalContent.length}`);
    return {
      content: finalContent,
      citation: citation || "No specific source available"
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    return {
      content: "I'm having trouble connecting to my knowledge base. Please try again later.",
      citation: "Error"
    };
  }
}

// Function to generate weekly summary
export async function generateWeeklySummary(slackMessages: string[], projectName: string) {
  try {
    // Get the settings
    const settings = await getSettings();
    
    // Get the model from settings
    let model = settings?.openaiModel || "gpt-4o";
    
    // Convert o4-mini to the correct format for the OpenAI API if needed
    if (model === "o4-mini") {
      model = "gpt-4o-mini";
    }
    
    // Use custom summary prompt if available, otherwise use the default
    const defaultSummaryPrompt = `You are an expert construction project manager. Create a concise weekly summary of activity for the ${projectName} homebuilding project based on Slack channel messages. Focus on key decisions, progress updates, issues, and upcoming milestones. Format the summary in HTML with sections for: 1) Key Achievements, 2) Issues or Blockers, 3) Upcoming Work, and 4) Action Items. Keep it professional and informative.`;
    
    // Use custom prompt from settings if available, replacing {{projectName}} with the actual project name
    const summaryPrompt = settings?.summaryPrompt 
      ? settings.summaryPrompt.replace(/{{projectName}}/g, projectName)
      : defaultSummaryPrompt;
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: summaryPrompt,
        },
        {
          role: "user",
          content: `Here are the Slack messages from the past week for the ${projectName} project:\n\n${slackMessages.join("\n\n")}`,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0].message.content || "Unable to generate summary.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    return `<p>Error generating weekly summary for ${projectName}. Please try again later.</p>`;
  }
}

// Function to generate a combined project summary from multiple chatbot summaries
export async function generateProjectSummary(
  projectName: string, 
  chatbotSummaries: Array<{ chatbotName: string, content: string }>,
  allProjectMessages: Array<{ chatbotName: string, messages: string[] }>
) {
  try {
    // Get the settings
    const settings = await getSettings();
    
    // Get the model from settings
    let model = settings?.openaiModel || "gpt-4o";
    
    // Convert o4-mini to the correct format for the OpenAI API if needed
    if (model === "o4-mini") {
      model = "gpt-4o-mini";
    }
    
    // Prepare the combined summary information
    const chatbotSummarySection = chatbotSummaries.map(summary => 
      `==== SUMMARY FROM ${summary.chatbotName} ====\n${summary.content}\n`
    ).join("\n\n");
    
    // Format all messages by chatbot for additional context
    const formattedMessages = allProjectMessages
      .filter(item => item.messages && item.messages.length > 0)
      .map(item => 
        `==== MESSAGES FROM ${item.chatbotName} ====\n${item.messages.join("\n")}\n`
      ).join("\n\n");
    
    // Custom prompt specifically for the project-level summary
    const projectSummaryPrompt = `You are an expert construction project manager responsible for creating a comprehensive weekly project summary. 

I'll provide you with:
1. Individual summaries from different chatbots/channels within the same project
2. The raw messages from these channels

Your task is to create a unified, master weekly summary for the entire "${projectName}" project that:
- Synthesizes information across all channels/chatbots
- Eliminates redundancies
- Highlights the most important developments
- Provides a clear overview of the entire project's status

Format your response in HTML with EXACTLY the same sections and format as the individual chatbot summaries:

1. Key Achievements
   - Use bullet points for each achievement
   - Include the most important accomplishments across all project areas

2. Issues or Blockers
   - Use bullet points for each issue
   - List any problems that need attention

3. Upcoming Work
   - Use bullet points for planned tasks
   - Include the important upcoming tasks for the next week

4. Action Items
   - Use bullet points for specific actions needed
   - List prioritized action items with clear owners when available

The summary MUST follow this EXACT format with numbered headings and bullet points. Keep your response professional and well-structured with proper HTML formatting. This summary will be sent to project stakeholders and executives.`;

    // Make the API call to generate the combined summary
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: projectSummaryPrompt,
        },
        {
          role: "user",
          content: `Here are the individual summaries from different aspects of the ${projectName} project:\n\n${chatbotSummarySection}\n\nHere are the raw messages from the past week for additional context if needed:\n\n${formattedMessages}`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent results
    });

    return response.choices[0].message.content || "Unable to generate project summary.";
  } catch (error) {
    console.error("OpenAI API error generating project summary:", error);
    return `Error generating master project summary for ${projectName}. Please try again later.`;
  }
}

/**
 * Test connection to OpenAI API
 * @returns Object with connection status and model details
 */
export async function testOpenAIConnection() {
  try {
    // Make a simple request to check if the API key is valid
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use a simpler model for the test
      messages: [
        {
          role: "user",
          content: "Hello, this is a connection test. Please respond with 'Connection successful'.",
        },
      ],
      max_tokens: 20,
      temperature: 0,
    });

    return {
      connected: true,
      model: response.model,
      response: response.choices[0].message.content,
      usage: response.usage
    };
  } catch (error: any) {
    console.error("OpenAI connection test failed:", error);
    return {
      connected: false,
      error: error?.response?.data?.error?.message || error?.message || "Unknown error"
    };
  }
}
