import { Request, Response } from "express";
import { storage } from "../storage";
import { getChatbotContext, formatTasksForChatbot, validateChatbotAccess } from "./chatbot-helpers";
import { getAsanaProjectTasks } from "./asana";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getChatbotResponse } from "./openai";

/**
 * Handles streaming API requests for chat endpoints
 */
export async function handleStreamingEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const chatbotId = parseInt(req.params.id);
    const { message, token } = req.body;
    
    // Check if token is valid
    const chatbot = await storage.getChatbot(chatbotId);
    
    if (!chatbot) {
      return res.status(404).json({ message: "Chatbot not found" });
    }
    
    // Check if this is a test page
    const isTestPage = req.headers.referer && 
      (req.headers.referer.includes('true-streaming-test.html') || 
       req.headers.referer.includes('streaming-test.html'));
    
    // Check token unless from test page
    if (!isTestPage && chatbot.requireAuth && chatbot.publicToken !== token) {
      return res.status(401).json({ message: "Valid token required" });
    }
    
    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    
    // Get context for the chatbot
    const { documents, slackMessages } = await getChatbotContext(chatbotId);
    
    // Debug logging
    console.log(`Chatbot ${chatbotId} documents count: ${documents.length}`);
    
    // Prepare the context sources for the prompt (exactly as in the chat endpoint)
    let contextSources = [
      "1. The project's initial documentation (budget, timeline, notes, plans, spreadsheets).",
      "2. The Slack message history from the project's dedicated Slack channel."
    ];
    
    // Prepare asana tasks data if available
    let asanaTasks: string[] = [];
    let hasAsanaProjects = false;
    
    // First check for the legacy single project (for backward compatibility)
    if (chatbot.asanaProjectId) {
      try {
        const asanaResult = await getAsanaProjectTasks(chatbot.asanaProjectId, true);
        if (asanaResult.success && asanaResult.tasks && asanaResult.tasks.length > 0) {
          hasAsanaProjects = true;
          
          // Format tasks for different views that might be requested
          const allTasksFormatted = formatTasksForChatbot(asanaResult.tasks, asanaResult.projectName || "Project", "all");
          const overdueTasksFormatted = formatTasksForChatbot(asanaResult.tasks, asanaResult.projectName || "Project", "overdue");
          const upcomingTasksFormatted = formatTasksForChatbot(asanaResult.tasks, asanaResult.projectName || "Project", "upcoming");
          const completedTasksFormatted = formatTasksForChatbot(asanaResult.tasks, asanaResult.projectName || "Project", "completed");
          
          // Add formatted task data to context
          asanaTasks = [...asanaTasks, allTasksFormatted, overdueTasksFormatted, upcomingTasksFormatted, completedTasksFormatted];
        }
      } catch (asanaError) {
        console.error("Error fetching legacy Asana project tasks:", asanaError);
      }
    }
    
    // Then get all linked Asana projects from the new table
    try {
      const asanaProjects = await storage.getChatbotAsanaProjects(chatbotId);
      
      if (asanaProjects.length > 0) {
        // Process each linked Asana project
        for (const project of asanaProjects) {
          try {
            const asanaResult = await getAsanaProjectTasks(project.asanaProjectId, true);
            if (asanaResult.success && asanaResult.tasks && asanaResult.tasks.length > 0) {
              hasAsanaProjects = true;
              
              // Get project name from our DB record or fallback to Asana API result
              const projectName = project.projectName || asanaResult.projectName || "Project";
              const projectType = project.projectType || "main";
              
              // Format tasks with project type (useful for filtering in prompt)
              const projectPrefix = `[${projectType.toUpperCase()}] ${projectName}`;
              
              // Format tasks for different views
              const allTasksFormatted = formatTasksForChatbot(asanaResult.tasks, projectPrefix, "all");
              const overdueTasksFormatted = formatTasksForChatbot(asanaResult.tasks, projectPrefix, "overdue");
              const upcomingTasksFormatted = formatTasksForChatbot(asanaResult.tasks, projectPrefix, "upcoming");
              const completedTasksFormatted = formatTasksForChatbot(asanaResult.tasks, projectPrefix, "completed");
              
              // Add formatted task data to context
              asanaTasks = [...asanaTasks, allTasksFormatted, overdueTasksFormatted, upcomingTasksFormatted, completedTasksFormatted];
            }
          } catch (projectError) {
            console.error(`Error fetching Asana tasks for project ${project.projectName}:`, projectError);
          }
        }
      }
    } catch (projectsError) {
      console.error("Error fetching Asana projects for chatbot:", projectsError);
    }
    
    // Add Asana as a context source if we have any tasks
    if (hasAsanaProjects) {
      contextSources.push("3. The project's Asana tasks and their status from multiple Asana projects.");
    }
    
    // Fetch settings to check for a custom system prompt template
    const appSettings = await storage.getSettings();
    
    // Default system prompt template - EXACTLY THE SAME as the regular chat endpoint
    const defaultSystemPromptTemplate = `You are a helpful assistant named SPH ChatBot assigned to the {{chatbotName}} homebuilding project. Your role is to provide project managers and executives with accurate, up-to-date answers about this construction project by referencing the following sources of information:

{{contextSources}}

Your job is to answer questions clearly and concisely. Always cite your source. If your answer comes from:
- a document: mention the filename and, if available, the page or section.
- Slack: mention the date and approximate time of the Slack message.
{{asanaNote}}

IMPORTANT FOR DOCUMENT PROCESSING:
1. You have access to project documents that contain critical information. Always search these documents thoroughly.
2. Pay special attention to content that begins with "SPREADSHEET DATA:" - this contains budget information, schedules, and project specifications.
3. For spreadsheet content, look for relevant cells and their values (e.g., "B12: $45,000") to answer budget and financial questions.
4. When answering questions about costs, timelines, or specifications, always prioritize information from documents over conversations.
5. Mention cell references (like "cell A5") when citing spreadsheet data to help users find the information.

IMPORTANT FOR ASANA TASKS: 
1. When users ask about "tasks", "Asana", "project status", "overdue", "upcoming", "progress", or other task-related information, ALWAYS prioritize checking the Asana data.
2. Pay special attention to content that begins with "ASANA TASK DATA:" in your provided context. This contains valuable task information.
3. When answering Asana-related questions, directly reference the tasks, including their status, due dates, and assignees if available.
4. Try to match the user's question with the most relevant task view (all tasks, overdue tasks, upcoming tasks, or completed tasks).

Respond using complete sentences. If the information is unavailable, say:  
"I wasn't able to find that information in the project files or messages."

You should **never make up information**. You may summarize or synthesize details if the answer is spread across multiple sources.`;
    
    // Determine which system prompt to use - EXACTLY THE SAME as the regular endpoint
    let systemPromptTemplate;
    
    if (chatbot.systemPrompt) {
      // Use chatbot-specific system prompt
      console.log(`Using custom system prompt for chatbot ${chatbotId}`);
      systemPromptTemplate = chatbot.systemPrompt;
    } else {
      // Fall back to app-wide prompt or default
      console.log(`Using app-wide system prompt for chatbot ${chatbotId}`);
      systemPromptTemplate = appSettings?.responseTemplate || defaultSystemPromptTemplate;
    }
    
    // Replace variables in the template
    let systemPrompt = systemPromptTemplate
      .replace(/{{chatbotName}}/g, chatbot.name)
      .replace(/{{contextSources}}/g, contextSources.join("\n"))
      .replace(/{{asanaNote}}/g, chatbot.asanaProjectId ? "- Asana: always mention that the information comes from Asana project tasks and include the project name." : "");
    
    // Add custom output format if specified
    if (chatbot.outputFormat) {
      systemPrompt += `\n\n${chatbot.outputFormat}`;
    }
    
    // Create message record in database
    const userMessage = await storage.createMessage({
      chatbotId,
      userId: req.user ? (req.user as any).id : null,
      content: message,
      isUserMessage: true,
      citation: null,
    });
    
    // Create a stream handler that will forward chunks to the client
    let fullResponse = '';
    
    const streamHandler = (chunk: string) => {
      // Add to the full response
      fullResponse += chunk;
      
      // Send the chunk as an SSE event
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    };
    
    // CRITICAL: Use getChatbotResponse with streaming handler
    // This ensures we use the exact same code path as the chat endpoint
    await getChatbotResponse(
      message,
      documents,
      [...slackMessages, ...asanaTasks],
      systemPrompt,
      chatbot.outputFormat,
      streamHandler // Pass our custom stream handler
    );
    
    // Extract citation if it exists
    let citation = "";
    const citationRegex = /\[(?:From |Source: |Slack(?: message)?,? )?(.*?)\]/;
    const match = fullResponse?.match(citationRegex);
    if (match && match[1]) {
      citation = match[1];
    }
    
    // Save the complete AI response to the database
    const botMessage = await storage.createMessage({
      chatbotId,
      userId: null,
      content: fullResponse,
      isUserMessage: false,
      citation: citation,
    });
    
    // Send completion event with message ID for client tracking
    res.write(`data: ${JSON.stringify({ done: true, messageId: botMessage.id })}\n\n`);
    res.end();
    
  } catch (error) {
    console.error("Error in stream endpoint:", error);
    
    // Only send error response if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ message: "Error generating response" });
    } else {
      // Send error via SSE
      res.write(`data: ${JSON.stringify({ error: "Error generating response" })}\n\n`);
      res.end();
    }
  }
}