import express from "express";
import OpenAI from "openai";
import { storage } from "../storage";
import { chatMessageSchema } from "@shared/schema";
import { getChatbotContext } from "../lib/vector-storage";
import { formatTasksForChatbot, getAsanaProjectTasks } from "../lib/asana";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Stream endpoint using the Responses API directly
router.post("/chatbots/:id/stream", async (req, res) => {
  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.socket?.setTimeout(0);  // Replit proxy: no idle timeout
  res.flushHeaders?.();

  try {
    const chatbotId = parseInt(req.params.id);
    const { message, token } = chatMessageSchema.parse(req.body);
    
    // Check if token is valid
    const chatbot = await storage.getChatbot(chatbotId);
    
    if (!chatbot) {
      res.write(`event: error\ndata:${JSON.stringify({ error: "Chatbot not found" })}\n\n`);
      return res.end();
    }
    
    // Check if this is a test page
    const isTestPage = req.headers.referer && 
      (req.headers.referer.includes('true-streaming-test.html') || 
       req.headers.referer.includes('streaming-test.html'));
    
    // Check token unless from test page
    if (!isTestPage && chatbot.requireAuth && chatbot.publicToken !== token) {
      res.write(`event: error\ndata:${JSON.stringify({ error: "Valid token required" })}\n\n`);
      return res.end();
    }
    
    // Get context for the chatbot
    const { documents, slackMessages } = await getChatbotContext(chatbotId);
    
    // Prepare context sources
    const contextSources = [
      "1. The project's initial documentation (budget, timeline, notes, plans, spreadsheets).",
      "2. The Slack message history from the project's dedicated Slack channel."
    ];
    
    // Prepare asana tasks data if available
    let asanaTasks: string[] = [];
    let hasAsanaProjects = false;
    
    // Get Asana projects data
    if (chatbot.asanaProjectId) {
      try {
        const asanaResult = await getAsanaProjectTasks(chatbot.asanaProjectId, true);
        if (asanaResult.success && asanaResult.tasks && asanaResult.tasks.length > 0) {
          hasAsanaProjects = true;
          
          // Format tasks for different views
          const allTasksFormatted = formatTasksForChatbot(asanaResult.tasks, asanaResult.projectName || "Project", "all");
          const overdueTasksFormatted = formatTasksForChatbot(asanaResult.tasks, asanaResult.projectName || "Project", "overdue");
          const upcomingTasksFormatted = formatTasksForChatbot(asanaResult.tasks, asanaResult.projectName || "Project", "upcoming");
          const completedTasksFormatted = formatTasksForChatbot(asanaResult.tasks, asanaResult.projectName || "Project", "completed");
          
          // Add formatted task data to context
          asanaTasks = [...asanaTasks, allTasksFormatted, overdueTasksFormatted, upcomingTasksFormatted, completedTasksFormatted];
        }
      } catch (asanaError) {
        console.error("Error fetching Asana project tasks:", asanaError);
      }
    }
    
    // Get linked Asana projects
    try {
      const asanaProjects = await storage.getChatbotAsanaProjects(chatbotId);
      
      for (const project of asanaProjects) {
        try {
          const asanaResult = await getAsanaProjectTasks(project.asanaProjectId, true);
          if (asanaResult.success && asanaResult.tasks && asanaResult.tasks.length > 0) {
            hasAsanaProjects = true;
            
            // Get project name from our DB record or fallback to Asana API result
            const projectName = project.projectName || asanaResult.projectName || "Project";
            const projectType = project.projectType || "main";
            
            // Format tasks with project type
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
    } catch (projectsError) {
      console.error("Error fetching Asana projects for chatbot:", projectsError);
    }
    
    // Add Asana as a context source if we have any tasks
    if (hasAsanaProjects) {
      contextSources.push("3. The project's Asana tasks and their status from multiple Asana projects.");
    }
    
    // Fetch settings to check for a custom system prompt template
    const appSettings = await storage.getSettings();
    
    // Default system prompt template
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
    
    // Determine which system prompt to use
    let systemPromptTemplate;
    
    if (chatbot.systemPrompt) {
      console.log(`Using custom system prompt for chatbot ${chatbotId}`);
      systemPromptTemplate = chatbot.systemPrompt;
    } else {
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
    
    // Prepare the messages for OpenAI
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    
    // Add context as a system message
    if (documents.length > 0 || slackMessages.length > 0 || asanaTasks.length > 0) {
      let contextMessage = "Here is relevant context to help answer the question:\n\n";
      
      if (documents.length > 0) {
        contextMessage += "PROJECT DOCUMENTS:\n" + documents.join("\n\n") + "\n\n";
      }
      
      if (slackMessages.length > 0) {
        contextMessage += "SLACK MESSAGES:\n" + slackMessages.join("\n\n") + "\n\n";
      }
      
      if (asanaTasks.length > 0) {
        contextMessage += "ASANA TASKS:\n" + asanaTasks.join("\n\n");
      }
      
      messages.push({ role: "system", content: contextMessage });
    }
    
    // Add the user's question
    messages.push({ role: "user", content: message });
    
    // Get settings to determine model
    const settings = await storage.getSettings();
    const model = settings?.openaiModel || "gpt-4o";
    
    console.log(`Starting OpenAI stream with model: ${model}`);
    
    // Create the true token-by-token streaming request to OpenAI
    const stream = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      stream: true,
    });
    
    // Track full response for database storage
    let fullResponse = '';
    
    // Process the stream
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      
      if (token) {
        // Add to the full response
        fullResponse += token;
        
        // Send the token directly (no JSON wrapping for better performance)
        res.write(`data:${token}\n\n`);
      }
    }
    
    console.log(`Streaming complete, full response length: ${fullResponse.length}`);
    
    // Extract citation if it exists
    let citation = "";
    const citationRegex = /\[(?:From |Source: |Slack(?: message)?,? )?(.*?)\]/;
    const match = fullResponse?.match(citationRegex);
    if (match && match[1]) {
      citation = match[1];
    }
    
    // Save response to database
    const botMessage = await storage.createMessage({
      chatbotId,
      userId: null,
      content: fullResponse,
      isUserMessage: false,
      citation,
    });
    
    // Send completion event
    res.write(`event:done\ndata:[DONE]\n\n`);
    res.end();
    
  } catch (error) {
    console.error("Error in streaming endpoint:", error);
    
    // Send error via SSE
    res.write(`event:error\ndata:${JSON.stringify({ error: "Error generating response" })}\n\n`);
    res.end();
  }
});

export default router;