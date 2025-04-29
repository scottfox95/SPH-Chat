import OpenAI from "openai";
import { storage } from "../storage";
import { Settings } from "@shared/schema";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder"
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
    
    // Extract Asana tasks (these were passed as strings)
    const asanaTasks = slackMessages.filter(msg => typeof msg === 'string');
    
    // Context for the model
    const context = [
      ...documents.map((doc) => `DOCUMENT: ${doc}`),
      ...formattedSlackMessages,
      ...asanaTasks.map(task => `ASANA TASK DATA: ${task}`)
    ].join("\n\n");

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
        content: `IMPORTANT - OUTPUT FORMAT: Your response MUST follow this exact format:\n${outputFormat}\nDo not deviate from this format in any way.`
      });
    }

    // Get the model from settings
    const model = await getCurrentModel();
    
    const response = await openai.chat.completions.create({
      model, // Use model from settings
      messages,
      temperature: 0.3,
    });

    const responseText = response.choices[0].message.content;
    
    // Parse the citation if it exists
    let citation = "";
    const citationRegex = /\[(?:From |Source: |Slack(?: message)?,? )?(.*?)\]/;
    const match = responseText?.match(citationRegex);
    
    if (match && match[1]) {
      citation = match[1];
    } else if (settings?.includeSourceDetails) {
      // Try to extract source details from the response text using patterns like "according to X on Y"
      const sourceRegex = /according to ([^\.]+)/i;
      const sourceMatch = responseText?.match(sourceRegex);
      if (sourceMatch && sourceMatch[1]) {
        citation = sourceMatch[1].trim();
      }
    }
    
    let finalContent = responseText || "I wasn't able to find that information in the project files or Slack messages.";
    
    // Only strip the citation if it's in the standard bracket format
    if (match && match[0]) {
      finalContent = finalContent.replace(citationRegex, "").trim();
    }
    
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
    const model = settings?.openaiModel || "gpt-4o";
    
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
