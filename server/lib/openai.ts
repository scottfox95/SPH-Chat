import OpenAI from "openai";
import { storage } from "../storage";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder"
});

// Helper to get the current model from settings
async function getCurrentModel(): Promise<string> {
  try {
    const settings = await storage.getSettings();
    return settings?.openaiModel || "gpt-4o";
  } catch (error) {
    console.error("Error getting OpenAI model from settings:", error);
    return "gpt-4o"; // Default to gpt-4o if settings retrieval fails
  }
}

// Function to get chatbot response
export async function getChatbotResponse(
  prompt: string,
  documents: string[],
  slackMessages: string[],
  systemPrompt: string
) {
  try {
    // Context for the model
    const context = [
      ...documents.map((doc) => `DOCUMENT: ${doc}`),
      ...slackMessages.map((msg) => `SLACK MESSAGE: ${msg}`),
    ].join("\n\n");

    // Get the model from settings
    const model = await getCurrentModel();
    
    const response = await openai.chat.completions.create({
      model, // Use model from settings
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `I need information about the following: ${prompt}\n\nHere's all the context I have:\n${context}`,
        },
      ],
      temperature: 0.3,
    });

    const responseText = response.choices[0].message.content;
    
    // Parse the citation if it exists
    let citation = "";
    const citationRegex = /\[(?:From |Source: |Slack(?: message)?,? )?(.*?)\]/;
    const match = responseText?.match(citationRegex);
    
    if (match && match[1]) {
      citation = match[1];
    }
    
    return {
      content: responseText?.replace(citationRegex, "").trim() || "I wasn't able to find that information in the project files or Slack messages.",
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
    // Get the model from settings
    const model = await getCurrentModel();
    
    const response = await openai.chat.completions.create({
      model, // Use model from settings
      messages: [
        {
          role: "system",
          content: `You are an expert construction project manager. Create a concise weekly summary of activity for the ${projectName} homebuilding project based on Slack channel messages. Focus on key decisions, progress updates, issues, and upcoming milestones. Format the summary in HTML with sections for: 1) Key Achievements, 2) Issues or Blockers, 3) Upcoming Work, and 4) Action Items. Keep it professional and informative.`,
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
