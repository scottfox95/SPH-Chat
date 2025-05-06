import OpenAI from "openai";
import { storage } from "../storage";
import { Settings } from "@shared/schema";

// Helper function to extract text content from Responses API output
// This handles all the different output formats that might be returned
function extractTextFromResponseOutput(output: any): string {
  console.log("DEBUG - Response output type:", typeof output);
  console.log("DEBUG - Response output (stringified):", JSON.stringify(output, null, 2));
  
  // Case 1: output is a simple string
  if (typeof output === 'string') {
    console.log("DEBUG - Output is a string, returning directly");
    return output;
  }
  
  // Case 2: output is null or undefined
  if (!output) {
    console.log("DEBUG - Output is null/undefined, returning empty string");
    return "";
  }
  
  // Case 3: output is an array of content items
  if (Array.isArray(output)) {
    console.log("DEBUG - Output is an array of length:", output.length);
    if (output.length === 0) return "";
    
    // Try to find text content in the array items
    for (const item of output) {
      // Check for text property (ResponseOutputMessage)
      if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
        console.log("DEBUG - Found text property in array item");
        return item.text;
      }
      
      // Check for content property 
      if (item && typeof item === 'object' && 'content' in item && typeof item.content === 'string') {
        console.log("DEBUG - Found content property in array item");
        return item.content;
      }
      
      // Check for value property (some response types use this)
      if (item && typeof item === 'object' && 'value' in item && typeof item.value === 'string') {
        console.log("DEBUG - Found value property in array item");
        return item.value;
      }
    }
    
    // If we couldn't find specific properties, stringify the first item as fallback
    console.log("DEBUG - No recognizable properties in array items, using first item as string");
    return String(output[0] || "");
  }
  
  // Case 4: output is an object with content property
  if (output && typeof output === 'object') {
    console.log("DEBUG - Output is an object, checking for known properties");
    
    if ('content' in output && typeof output.content === 'string') {
      console.log("DEBUG - Found content property");
      return output.content;
    }
    
    if ('text' in output && typeof output.text === 'string') {
      console.log("DEBUG - Found text property");
      return output.text;
    }
    
    if ('value' in output && typeof output.value === 'string') {
      console.log("DEBUG - Found value property");
      return output.value;
    }
    
    // Special case for o4 model which sometimes returns nested structure
    if ('text' in output && typeof output.text === 'object') {
      console.log("DEBUG - Found text as object, trying to extract text from it");
      const textObj = output.text;
      if (textObj && 'value' in textObj && typeof textObj.value === 'string') {
        return textObj.value;
      }
    }
    
    // Special case for JSON output from models like gpt-4o
    try {
      const jsonString = JSON.stringify(output);
      console.log("DEBUG - Stringified output:", jsonString.substring(0, 100) + "...");
      
      // If it looks like a JSON object with text/value/content, try to extract
      if (jsonString.includes('"text":') || jsonString.includes('"value":') || jsonString.includes('"content":')) {
        console.log("DEBUG - JSON contains text/value/content properties, attempting extraction");
        
        // Try various paths that might contain the content
        if (output.value && typeof output.value === 'string') return output.value;
        if (output.message && output.message.content) return output.message.content;
        if (output.choices && output.choices[0] && output.choices[0].message) {
          return output.choices[0].message.content || "";
        }
      }
    } catch (error) {
      console.log("DEBUG - Error stringifying output:", error);
    }
  }
  
  // Case 5: Fallback - convert to string as last resort
  console.log("DEBUG - Using fallback string conversion");
  try {
    if (typeof output === 'object') {
      return JSON.stringify(output) || "";
    }
    return String(output || "");
  } catch (error) {
    console.error("Error converting output to string:", error);
    return "Error extracting response text";
  }
}

// Initialize OpenAI client with the API key from environment variables
// This client will be used with the Responses API released March 2025
// Models use different naming conventions in this API (e.g., "o4" instead of "gpt-4o")
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

    // Get the model from settings - use the correct format for Responses API
    let model = await getCurrentModel();
    
    // The Responses API uses simplified model names (e.g., "o4-mini" not "gpt-4o-mini")
    // No need to add the "gpt-" prefix as we're using the Responses API
    
    console.log(`Using OpenAI model: ${model}`);
    
    // Prepare the input from our messages
    // Convert from Chat Completions format to Responses API format
    let systemPromptText = messages.find(m => m.role === "system")?.content || "";
    let userPromptText = messages.find(m => m.role === "user")?.content || "";
    
    // Extract output format requirements if any
    const formatMessage = messages.find(m => 
      m.role === "system" && m.content?.includes("OUTPUT FORMAT")
    );
    const hasFormatRequirements = !!formatMessage;
    
    console.log(`Making request to OpenAI Responses API`);
    console.log(`System prompt length: ${systemPromptText.length}, User prompt length: ${userPromptText.length}`);
    
    const startTime = Date.now();
    
    // Use the OpenAI Responses API (March 2025)
    // Reference: https://platform.openai.com/docs/api-reference/responses
    console.log(`Making OpenAI Responses API request with model: ${model}`);
    
    // Convert legacy model name format if needed
    // The Responses API uses simplified model names (e.g., "o4" instead of "gpt-4o")
    if (model.startsWith("gpt-")) {
      if (model === "gpt-4o") model = "o4";
      else if (model === "gpt-4o-mini") model = "o4-mini";
      // Add other model conversions as needed
    }
    
    // Use the OpenAI Responses API
    // Create request parameters without temperature or tools to avoid compatibility issues with some models
    const requestParams: any = {
      model,
      instructions: systemPromptText, // System prompt becomes instructions
      input: userPromptText,          // User message becomes input
      max_output_tokens: 4000,        // Renamed from max_tokens
    };
    
    // Only add temperature if we're using a model that supports it
    // This avoids the "Unsupported parameter: 'temperature'" error with some models
    // Debug logs to trace model and temperature decisions
    console.log(`DEBUG - Model before temperature check: "${model}"`);
    console.log(`DEBUG - Model type check: model !== "o1": ${model !== "o1"}, !model.includes("-preview"): ${!model.includes("-preview")}, !model.includes("o4-mini"): ${!model.includes("o4-mini")}`);
    
    if (model !== "o1" && !model.includes("-preview") && !model.includes("o4-mini")) {
      console.log(`DEBUG - Adding temperature parameter for model: ${model}`);
      requestParams.temperature = 0.3;
    } else {
      console.log(`DEBUG - Skipping temperature parameter for model: ${model}`);
    }
    
    // We discovered web_search_preview isn't supported with o4 in the Responses API
    // Let's skip this tool for now as it causes errors
    // This is different from the Chat Completions API where gpt-4o does support web_search_preview
    /*
    if (model === "o4" || model === "gpt-4o") {
      requestParams.tools = [{"type": "web_search_preview"}]; 
    }
    */
    // Log the entire request parameters for debugging
    console.log(`DEBUG - Final request parameters for chatbot response:`);
    console.log(JSON.stringify(requestParams, null, 2));
    
    const response = await openai.responses.create(requestParams);
    
    const endTime = Date.now();
    console.log(`OpenAI API request completed in ${endTime - startTime}ms`);

    // Extract text content from the response using our helper function
    // This handles all possible output formats from the Responses API
    const responseText = extractTextFromResponseOutput(response.output);
    console.log(`Response received with ${responseText.length} characters`);
    
    // Parse the citation if it exists
    let citation = "";
    const citationRegex = /\[(?:From |Source: |Slack(?: message)?,? )?(.*?)\]/;
    const match = responseText?.match(citationRegex);
    
    // Check if responseText is valid and not just "[object Object]"
    if (responseText === "[object Object]" || responseText.includes("object Object")) {
      console.log("WARNING: Response contains [object Object] instead of actual content. This indicates a formatting error.");
      // We'll set a proper response content later
    }
    
    if (match && match[1]) {
      // Make sure citation is a string
      if (typeof match[1] === 'string') {
        citation = match[1];
        console.log(`Citation found in standard format: ${citation}`);
      } else {
        console.log(`Citation found but in unexpected format: ${typeof match[1]}`);
        try {
          citation = JSON.stringify(match[1]);
        } catch (e) {
          citation = "Citation extraction error";
        }
      }
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
    
    // Handle the case where responseText is invalid
    let finalContent = "";
    
    if (responseText === "[object Object]" || responseText.includes("object Object")) {
      // We detected an object being stringified incorrectly
      console.log("Converting invalid [object Object] to readable message");
      finalContent = "I'm having trouble processing the information. Let me try again with a more specific question.";
    } else {
      finalContent = responseText || "I wasn't able to find that information in the project files or Slack messages.";
      
      // Only strip the citation if it's in the standard bracket format
      if (match && match[0]) {
        finalContent = finalContent.replace(citationRegex, "").trim();
      }
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
    
    // Use the OpenAI Responses API
    console.log(`Making OpenAI Responses API request for weekly summary for ${projectName}`);
    
    // Convert legacy model name format if needed
    if (model.startsWith("gpt-")) {
      if (model === "gpt-4o") model = "o4";
      else if (model === "gpt-4o-mini") model = "o4-mini";
      // Add other model conversions as needed
    }
    
    // Create request parameters without temperature or tools to avoid compatibility issues with some models
    const requestParams: any = {
      model,
      instructions: summaryPrompt,
      input: `Here are the Slack messages from the past week for the ${projectName} project:\n\n${slackMessages.join("\n\n")}`,
      max_output_tokens: 4000
    };
    
    // Only add temperature if we're using a model that supports it
    console.log(`DEBUG - Weekly Summary - Model before temperature check: "${model}"`);
    console.log(`DEBUG - Weekly Summary - Model type check: model !== "o1": ${model !== "o1"}, !model.includes("-preview"): ${!model.includes("-preview")}, !model.includes("o4-mini"): ${!model.includes("o4-mini")}`);
    
    if (model !== "o1" && !model.includes("-preview") && !model.includes("o4-mini")) {
      console.log(`DEBUG - Weekly Summary - Adding temperature parameter for model: ${model}`);
      requestParams.temperature = 0.5;
    } else {
      console.log(`DEBUG - Weekly Summary - Skipping temperature parameter for model: ${model}`);
    }
    
    // We discovered web_search_preview isn't supported with o4 in the Responses API
    // Let's skip this tool for now as it causes errors
    /*
    if (model === "o4" || model === "gpt-4o") {
      requestParams.tools = [{"type": "web_search_preview"}];
    }
    */
    
    const response = await openai.responses.create(requestParams);

    // Extract text content from the response using our helper function
    return extractTextFromResponseOutput(response.output) || "Unable to generate summary.";
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

    // Convert legacy model name format if needed
    if (model.startsWith("gpt-")) {
      if (model === "gpt-4o") model = "o4";
      else if (model === "gpt-4o-mini") model = "o4-mini";
      // Add other model conversions as needed
    }
    
    // Make the API call to generate the combined summary using Responses API
    // Create request parameters without temperature or tools to avoid compatibility issues with some models
    const requestParams: any = {
      model,
      instructions: projectSummaryPrompt,
      input: `Here are the individual summaries from different aspects of the ${projectName} project:\n\n${chatbotSummarySection}\n\nHere are the raw messages from the past week for additional context if needed:\n\n${formattedMessages}`,
      max_output_tokens: 4000
    };
    
    // We discovered web_search_preview isn't supported with o4 in the Responses API
    // Let's skip this tool for now as it causes errors
    /*
    if (model === "o4" || model === "gpt-4o") {
      requestParams.tools = [{"type": "web_search_preview"}];
    }
    */
    
    // Only add temperature if we're using a model that supports it
    console.log(`DEBUG - Project Summary - Model before temperature check: "${model}"`);
    console.log(`DEBUG - Project Summary - Model type check: model !== "o1": ${model !== "o1"}, !model.includes("-preview"): ${!model.includes("-preview")}, !model.includes("o4-mini"): ${!model.includes("o4-mini")}`);
    
    if (model !== "o1" && !model.includes("-preview") && !model.includes("o4-mini")) {
      console.log(`DEBUG - Project Summary - Adding temperature parameter for model: ${model}`);
      requestParams.temperature = 0.3; // Lower temperature for more consistent results
    } else {
      console.log(`DEBUG - Project Summary - Skipping temperature parameter for model: ${model}`);
    }
    
    const response = await openai.responses.create(requestParams);

    // Extract text content from the response using our helper function
    return extractTextFromResponseOutput(response.output) || "Unable to generate project summary.";
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
    // Get the model from settings - same as we do for actual requests
    let model = await getCurrentModel();
    console.log(`Testing OpenAI connection with model from settings: ${model}`);
    
    // Convert legacy model name format if needed
    if (model.startsWith("gpt-")) {
      if (model === "gpt-4o") model = "o4";
      else if (model === "gpt-4o-mini") model = "o4-mini";
      // Add other model conversions as needed
    }
    
    console.log(`Converted model name for test: ${model}`);
    
    // Make a simple request to check if the API key is valid using Responses API
    // Create request parameters without temperature to avoid compatibility issues with some models
    const requestParams: any = {
      model: model, // Use the model from settings
      instructions: "You are a helpful assistant responding to a connection test.",
      input: "Hello, this is a connection test. Please respond with 'Connection successful'.",
      max_output_tokens: 20
    };
    
    // Add temperature parameter conditionally based on the model
    // Same check as in the other functions
    if (model !== "o1" && !model.includes("-preview") && !model.includes("o4-mini")) {
      console.log(`Adding temperature parameter for test with model: ${model}`);
      requestParams.temperature = 0.3;
    } else {
      console.log(`Skipping temperature parameter for test with model: ${model}`);
    }
    
    // We discovered web_search_preview isn't supported with o4 in the Responses API
    // Let's skip this tool for now as it causes errors
    /*
    if (model === "o4" || model === "gpt-4o") {
      console.log(`Adding web_search_preview tool for test with model: ${model}`);
      requestParams.tools = [{"type": "web_search_preview"}];
    } else {
      console.log(`Skipping web_search_preview tool for test with model: ${model}`);
    }
    */
    console.log(`Skipping web_search_preview tools for all models to avoid API errors`);
    
    const response = await openai.responses.create(requestParams);

    return {
      connected: true,
      model: response.model,
      response: extractTextFromResponseOutput(response.output) || "Connection successful",
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
