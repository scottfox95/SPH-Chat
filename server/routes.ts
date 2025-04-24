import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { upload } from "./middleware/multer";
import { z } from "zod";
import { 
  loginSchema, 
  chatMessageSchema, 
  addEmailRecipientSchema, 
  addAsanaProjectSchema,
  updateSettingsSchema,
  OPENAI_MODELS
} from "@shared/schema";
import { getChatbotResponse, generateWeeklySummary, testOpenAIConnection } from "./lib/openai";
import { 
  getFormattedSlackMessages, 
  getWeeklySlackMessages, 
  testSlackConnection, 
  validateSlackChannel,
  listAccessibleChannels,
  slack // Import the slack client directly for testing
} from "./lib/slack";
import {
  testAsanaConnection,
  getAsanaProjects,
  getAsanaProjectTasks,
  getAsanaTaskDetails,
  formatTasksForChatbot
} from "./lib/asana";
import { processDocument } from "./lib/document-processor";
import { getChatbotContext, clearDocumentCache } from "./lib/vector-storage";
import { sendSummaryEmail } from "./lib/email";
import * as fs from "fs";
import { nanoid } from "nanoid";
import { format } from "date-fns";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  const { isAuthenticated } = setupAuth(app);

  // API routes
  const apiRouter = express.Router();
  
  // Chatbot routes - protected with authentication
  apiRouter.get("/chatbots", isAuthenticated, async (req, res) => {
    const chatbots = await storage.getChatbots();
    res.json(chatbots);
  });
  
  apiRouter.get("/chatbots/:id", isAuthenticated, async (req, res) => {
    const chatbot = await storage.getChatbot(parseInt(req.params.id));
    
    if (!chatbot) {
      return res.status(404).json({ message: "Chatbot not found" });
    }
    
    res.json(chatbot);
  });
  
  apiRouter.post("/chatbots", isAuthenticated, async (req, res) => {
    try {
      const { name, slackChannelId } = req.body;
      
      if (!name || !slackChannelId) {
        return res.status(400).json({ message: "Name and Slack channel ID are required" });
      }
      
      // Validate the Slack channel ID before creating the chatbot
      const channelValidation = await validateSlackChannel(slackChannelId);
      
      if (!channelValidation.valid) {
        return res.status(400).json({ 
          message: "Invalid Slack channel",
          details: channelValidation.error || "The channel ID is invalid or the bot doesn't have access to it."
        });
      }
      
      const user = req.user as Express.User;
      const chatbot = await storage.createChatbot({
        name,
        slackChannelId,
        createdById: user.id,
        isActive: true,
        requireAuth: false,
      });
      
      res.status(201).json(chatbot);
    } catch (error) {
      console.error("Error creating chatbot:", error);
      res.status(500).json({ message: "Failed to create chatbot" });
    }
  });
  
  apiRouter.put("/chatbots/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, slackChannelId, asanaProjectId, isActive, requireAuth } = req.body;
      
      const chatbot = await storage.getChatbot(id);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // If a new Slack channel ID is provided, validate it
      if (slackChannelId && slackChannelId !== chatbot.slackChannelId) {
        const channelValidation = await validateSlackChannel(slackChannelId);
        
        if (!channelValidation.valid) {
          return res.status(400).json({ 
            message: "Invalid Slack channel",
            details: channelValidation.error || "The channel ID is invalid or the bot doesn't have access to it."
          });
        }
      }
      
      // If a new Asana project ID is provided, validate it
      if (asanaProjectId && asanaProjectId !== chatbot.asanaProjectId) {
        try {
          const projectResponse = await getAsanaProjectTasks(asanaProjectId, false);
          
          if (!projectResponse.success) {
            return res.status(400).json({ 
              message: "Invalid Asana project ID",
              details: projectResponse.error || "The project ID is invalid or cannot be accessed with the current Asana PAT."
            });
          }
        } catch (error) {
          return res.status(400).json({ 
            message: "Invalid Asana project ID",
            details: "The project ID could not be validated. Please ensure it's a valid Asana project ID."
          });
        }
      }
      
      const updatedChatbot = await storage.updateChatbot(id, {
        name: name || chatbot.name,
        slackChannelId: slackChannelId || chatbot.slackChannelId,
        asanaProjectId: asanaProjectId !== undefined ? asanaProjectId : chatbot.asanaProjectId,
        isActive: isActive !== undefined ? isActive : chatbot.isActive,
        requireAuth: requireAuth !== undefined ? requireAuth : chatbot.requireAuth,
        createdById: chatbot.createdById,
        publicToken: chatbot.publicToken,
      });
      
      res.json(updatedChatbot);
    } catch (error) {
      console.error("Error updating chatbot:", error);
      res.status(500).json({ message: "Failed to update chatbot" });
    }
  });
  
  apiRouter.delete("/chatbots/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const success = await storage.deleteChatbot(id);
      
      if (!success) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chatbot:", error);
      res.status(500).json({ message: "Failed to delete chatbot" });
    }
  });
  
  // Document routes
  apiRouter.get("/documents", async (req, res) => {
    try {
      // Get all chatbots first
      const chatbots = await storage.getChatbots();
      
      // Create a map of chatbot IDs to names for reference
      const chatbotNames = new Map(
        chatbots.map(chatbot => [chatbot.id, chatbot.name])
      );
      
      // Get all documents from all chatbots
      const allDocumentsPromises = chatbots.map(chatbot => 
        storage.getDocuments(chatbot.id)
      );
      
      const allDocumentsArrays = await Promise.all(allDocumentsPromises);
      
      // Flatten the array of arrays and add chatbot name to each document
      const documents = allDocumentsArrays
        .flat()
        .map(doc => ({
          ...doc,
          chatbotName: chatbotNames.get(doc.chatbotId) || "Unknown"
        }));
      
      res.json(documents);
    } catch (error) {
      console.error("Error fetching all documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  apiRouter.get("/chatbots/:id/documents", async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      const documents = await storage.getDocuments(chatbotId);
      
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });
  
  apiRouter.post("/chatbots/:id/documents", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const { filename, originalname, mimetype } = req.file;
      
      const user = req.user as Express.User;
      const document = await storage.createDocument({
        chatbotId,
        filename,
        originalName: originalname,
        fileType: mimetype,
        uploadedById: user.id
      });
      
      // Clear document cache for this chatbot
      clearDocumentCache(chatbotId);
      
      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });
  
  // Asana project routes
  apiRouter.get("/chatbots/:id/asana-projects", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      const projects = await storage.getChatbotAsanaProjects(chatbotId);
      
      res.json(projects);
    } catch (error) {
      console.error("Error fetching Asana projects:", error);
      res.status(500).json({ message: "Failed to fetch Asana projects" });
    }
  });
  
  apiRouter.post("/chatbots/:id/asana-projects", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      const { asanaProjectId, projectName, projectType } = req.body;
      
      // Validate the data
      const validatedData = addAsanaProjectSchema.parse({
        chatbotId,
        asanaProjectId,
        projectName,
        projectType: projectType || "main"
      });
      
      // Check if the Asana project is valid
      try {
        const projectResponse = await getAsanaProjectTasks(asanaProjectId, false);
        
        if (!projectResponse.success) {
          return res.status(400).json({ 
            message: "Invalid Asana project ID",
            details: projectResponse.error || "The project ID is invalid or cannot be accessed with the current Asana PAT."
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          message: "Invalid Asana project ID",
          details: "The project ID could not be validated. Please ensure it's a valid Asana project ID."
        });
      }
      
      // Add the project
      const project = await storage.addChatbotAsanaProject(validatedData);
      
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error adding Asana project:", error);
      res.status(500).json({ message: "Failed to add Asana project" });
    }
  });
  
  apiRouter.delete("/asana-projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const success = await storage.deleteChatbotAsanaProject(id);
      
      if (!success) {
        return res.status(404).json({ message: "Asana project association not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting Asana project association:", error);
      res.status(500).json({ message: "Failed to delete Asana project association" });
    }
  });
  
  apiRouter.delete("/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const document = await storage.getDocuments(0).then(docs => 
        docs.find(doc => doc.id === id)
      );
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const success = await storage.deleteDocument(id);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to delete document" });
      }
      
      // Delete the actual file
      try {
        fs.unlinkSync(`uploads/${document.filename}`);
      } catch (err) {
        console.error("Error deleting file:", err);
      }
      
      // Clear document cache for this chatbot
      clearDocumentCache(document.chatbotId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });
  
  // Email recipient routes
  apiRouter.get("/chatbots/:id/recipients", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      const recipients = await storage.getEmailRecipients(chatbotId);
      
      res.json(recipients);
    } catch (error) {
      console.error("Error fetching recipients:", error);
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });
  
  apiRouter.post("/chatbots/:id/recipients", isAuthenticated, async (req, res) => {
    try {
      const data = addEmailRecipientSchema.parse({
        ...req.body,
        chatbotId: parseInt(req.params.id),
      });
      
      const recipient = await storage.createEmailRecipient(data);
      
      res.status(201).json(recipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error adding recipient:", error);
      res.status(500).json({ message: "Failed to add recipient" });
    }
  });
  
  apiRouter.delete("/recipients/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const success = await storage.deleteEmailRecipient(id);
      
      if (!success) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting recipient:", error);
      res.status(500).json({ message: "Failed to delete recipient" });
    }
  });
  
  // Summary routes
  apiRouter.get("/chatbots/:id/summaries", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      const summaries = await storage.getSummaries(chatbotId);
      
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ message: "Failed to fetch summaries" });
    }
  });
  
  apiRouter.post("/chatbots/:id/generate-summary", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      const chatbot = await storage.getChatbot(chatbotId);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // Get messages from the last week
      const messages = await getWeeklySlackMessages(chatbot.slackChannelId);
      
      if (messages.length === 0) {
        return res.status(400).json({ message: "No messages found for the past week" });
      }
      
      // Generate summary
      const formattedMessages = messages.map(msg => `${msg.user}: ${msg.text}`);
      const content = await generateWeeklySummary(formattedMessages, chatbot.name);
      
      // Create week identifier (e.g., "2023-W12")
      const week = format(new Date(), "yyyy-'W'ww");
      
      // Save summary
      const summary = await storage.createSummary({
        chatbotId,
        content,
        week,
      });
      
      // Send email to recipients
      const emailResult = await sendSummaryEmail(
        chatbotId,
        `Weekly Summary: ${chatbot.name} - ${format(new Date(), "MMMM d, yyyy")}`,
        content
      );
      
      res.json({
        summary,
        emailSent: emailResult.success,
        emailDetails: emailResult,
      });
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ message: "Failed to generate summary" });
    }
  });
  
  // Chat message routes
  apiRouter.get("/chatbots/:id/messages", async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      const token = req.query.token as string;
      
      // Check if token is valid
      const chatbot = await storage.getChatbot(chatbotId);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // Check token if authentication is required
      if (chatbot.requireAuth && chatbot.publicToken !== token) {
        return res.status(401).json({ message: "Valid token required" });
      }
      
      const messages = await storage.getMessages(chatbotId);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  // Clear chat history
  apiRouter.delete("/chatbots/:id/messages", async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      const token = req.query.token as string;
      
      // Check if token is valid
      const chatbot = await storage.getChatbot(chatbotId);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // Check token if authentication is required
      if (chatbot.requireAuth && chatbot.publicToken !== token) {
        return res.status(401).json({ message: "Valid token required" });
      }
      
      const success = await storage.clearMessages(chatbotId);
      
      res.json({ success });
    } catch (error) {
      console.error("Error clearing messages:", error);
      res.status(500).json({ message: "Failed to clear chat history" });
    }
  });
  
  apiRouter.post("/chatbots/:id/chat", async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      const { message, token } = chatMessageSchema.parse(req.body);
      
      // Check if token is valid
      const chatbot = await storage.getChatbot(chatbotId);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // Check token if authentication is required
      if (chatbot.requireAuth && chatbot.publicToken !== token) {
        return res.status(401).json({ message: "Valid token required" });
      }
      
      // Get context for the chatbot
      const { documents, slackMessages } = await getChatbotContext(chatbotId);
      
      // Prepare the context sources for the prompt
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
      
      // Default system prompt template
      const defaultSystemPromptTemplate = `You are a helpful assistant named SPH ChatBot assigned to the {{chatbotName}} homebuilding project. Your role is to provide project managers and executives with accurate, up-to-date answers about this construction project by referencing the following sources of information:

{{contextSources}}

Your job is to answer questions clearly and concisely. Always cite your source. If your answer comes from:
- a document: mention the filename and, if available, the page or section.
- Slack: mention the date and approximate time of the Slack message.
{{asanaNote}}

IMPORTANT FOR ASANA TASKS: 
1. When users ask about "tasks", "Asana", "project status", "overdue", "upcoming", "progress", or other task-related information, ALWAYS prioritize checking the Asana data.
2. Pay special attention to content that begins with "ASANA TASK DATA:" in your provided context. This contains valuable task information.
3. When answering Asana-related questions, directly reference the tasks, including their status, due dates, and assignees if available.
4. Try to match the user's question with the most relevant task view (all tasks, overdue tasks, upcoming tasks, or completed tasks).

Respond using complete sentences. If the information is unavailable, say:  
"I wasn't able to find that information in the project files or messages."

You should **never make up information**. You may summarize or synthesize details if the answer is spread across multiple sources.`;
      
      // Get the system prompt (either from settings or use default)
      let systemPromptTemplate = appSettings?.responseTemplate || defaultSystemPromptTemplate;
      
      // Replace variables in the template
      let systemPrompt = systemPromptTemplate
        .replace(/{{chatbotName}}/g, chatbot.name)
        .replace(/{{contextSources}}/g, contextSources.join("\n"))
        .replace(/{{asanaNote}}/g, chatbot.asanaProjectId ? "- Asana: always mention that the information comes from Asana project tasks and include the project name." : "");
      
      // Save user message - use token-based access, no need for user ID (public interface)
      const userMessage = await storage.createMessage({
        chatbotId,
        userId: null, // No user ID for token-based public access
        content: message,
        isUserMessage: true,
        citation: null,
      });
      
      // Get response from OpenAI
      const aiResponse = await getChatbotResponse(
        message,
        documents,
        [...slackMessages, ...asanaTasks],
        systemPrompt
      );
      
      // Save AI response
      const botMessage = await storage.createMessage({
        chatbotId,
        userId: null,
        content: aiResponse.content,
        isUserMessage: false,
        citation: aiResponse.citation,
      });
      
      res.json({
        userMessage,
        botMessage,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error processing chat:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });
  
  // Public chatbot routes
  apiRouter.get("/public/chatbot/:token", async (req, res) => {
    try {
      const token = req.params.token;
      
      const chatbot = await storage.getChatbotByToken(token);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // Don't send sensitive info
      const sanitizedChatbot = {
        id: chatbot.id,
        name: chatbot.name,
        publicToken: chatbot.publicToken,
        isActive: chatbot.isActive,
        requireAuth: chatbot.requireAuth,
      };
      
      res.json(sanitizedChatbot);
    } catch (error) {
      console.error("Error fetching public chatbot:", error);
      res.status(500).json({ message: "Failed to fetch chatbot" });
    }
  });
  
  // System connection test routes
  apiRouter.get("/system/test-slack", async (req, res) => {
    try {
      const result = await testSlackConnection();
      
      // Add detailed scope information if available
      try {
        // Try the users.list endpoint to directly test the users:read scope
        const usersResult = await slack.users.list({ limit: 1 });
        result.hasUsersReadScope = true;
        result.usersSample = usersResult.members ? 
          usersResult.members.slice(0, 2).map(m => ({ 
            id: m.id, 
            name: m.name, 
            real_name: m.real_name,
            is_bot: m.is_bot
          })) : [];
      } catch (scopeError: any) {
        result.hasUsersReadScope = false;
        result.usersReadError = scopeError?.data?.error || 'unknown_error';
        result.usersReadErrorDetails = {
          needed: scopeError?.data?.needed,
          provided: scopeError?.data?.provided
        };
      }
      
      // Get information about the token through auth.test
      try {
        const authTestResult = await slack.auth.test();
        result.tokenInfo = {
          user: authTestResult.user,
          team: authTestResult.team,
          botId: authTestResult.bot_id,
          userId: authTestResult.user_id
        };
      } catch (authError) {
        console.error("Error getting token info:", authError);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error testing Slack connection:", error);
      res.status(500).json({ 
        connected: false, 
        error: "Failed to test Slack connection" 
      });
    }
  });
  
  apiRouter.get("/system/test-openai", async (req, res) => {
    try {
      const result = await testOpenAIConnection();
      res.json(result);
    } catch (error) {
      console.error("Error testing OpenAI connection:", error);
      res.status(500).json({ 
        connected: false, 
        error: "Failed to test OpenAI connection" 
      });
    }
  });
  
  // Test Asana connection
  apiRouter.get("/system/test-asana", async (req, res) => {
    try {
      console.log("Received request to test Asana connection");
      const result = await testAsanaConnection();
      console.log("Asana connection test result:", JSON.stringify(result));
      res.json(result);
    } catch (error) {
      console.error("Error testing Asana connection:", error);
      const errorDetails = error instanceof Error ? error.stack : String(error);
      console.error("Detailed error:", errorDetails);
      
      res.status(500).json({ 
        connected: false, 
        message: "Failed to test Asana connection",
        error: error instanceof Error ? error.message : "An unexpected error occurred"
      });
    }
  });
  
  // Validate Slack channel
  apiRouter.get("/system/validate-slack-channel", async (req, res) => {
    try {
      const channelId = req.query.channelId as string;
      
      if (!channelId) {
        return res.status(400).json({ message: "Channel ID is required" });
      }
      
      const result = await validateSlackChannel(channelId);
      res.json(result);
    } catch (error) {
      console.error("Error validating Slack channel:", error);
      res.status(500).json({ 
        valid: false, 
        error: "Failed to validate Slack channel" 
      });
    }
  });
  
  // List accessible Slack channels
  apiRouter.get("/system/slack-channels", async (req, res) => {
    try {
      const channels = await listAccessibleChannels();
      res.json(channels);
    } catch (error) {
      console.error("Error listing Slack channels:", error);
      res.status(500).json({ 
        error: "Failed to list Slack channels",
        details: error.message || "Unknown error"
      });
    }
  });
  
  // List Asana projects from workspace
  apiRouter.get("/system/asana-projects", async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      
      if (!workspaceId) {
        return res.status(400).json({ message: "Workspace ID is required" });
      }
      
      const result = await getAsanaProjects(workspaceId);
      res.json(result);
    } catch (error) {
      console.error("Error listing Asana projects:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to list Asana projects",
        details: error.message || "Unknown error"
      });
    }
  });
  
  // Get tasks from Asana project
  apiRouter.get("/system/asana-tasks", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const includeCompleted = req.query.includeCompleted === 'true';
      
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }
      
      const result = await getAsanaProjectTasks(projectId, includeCompleted);
      res.json(result);
    } catch (error) {
      console.error("Error fetching Asana tasks:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch Asana tasks",
        details: error.message || "Unknown error"
      });
    }
  });
  
  // Get details of a specific Asana task
  apiRouter.get("/system/asana-task-details", async (req, res) => {
    try {
      const taskId = req.query.taskId as string;
      
      if (!taskId) {
        return res.status(400).json({ message: "Task ID is required" });
      }
      
      const result = await getAsanaTaskDetails(taskId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching Asana task details:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch Asana task details",
        details: error.message || "Unknown error"
      });
    }
  });
  
  // Settings routes
  apiRouter.get("/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      
      // Return settings object with available models
      res.json({
        ...settings,
        availableModels: OPENAI_MODELS
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });
  
  apiRouter.put("/settings", isAuthenticated, async (req, res) => {
    try {
      const data = updateSettingsSchema.parse(req.body);
      
      const settings = await storage.updateSettings(data);
      
      // Return settings object with available models
      res.json({
        ...settings,
        availableModels: OPENAI_MODELS
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
  
  // Get API token status (not the actual tokens)
  apiRouter.get("/settings/api-tokens/status", isAuthenticated, async (req, res) => {
    try {
      // Check each service token
      const services = ['slack', 'openai', 'asana'];
      const tokenStatus: Record<string, { exists: boolean; lastUpdated: Date | null }> = {};
      
      for (const service of services) {
        const token = await storage.getApiToken(service);
        tokenStatus[service] = {
          exists: !!token,
          lastUpdated: token ? token.updatedAt : null
        };
      }
      
      res.json(tokenStatus);
    } catch (error) {
      console.error("Error fetching API token status:", error);
      res.status(500).json({ message: "Failed to fetch API token status" });
    }
  });
  
  // Update API tokens (stored securely in database)
  apiRouter.put("/settings/api-tokens", isAuthenticated, async (req, res) => {
    try {
      const { type, token } = req.body;
      
      if (!type || !token) {
        return res.status(400).json({ message: "Token type and value are required" });
      }
      
      // Validate token type
      if (!['slack', 'openai', 'asana'].includes(type)) {
        return res.status(400).json({ message: "Invalid token type" });
      }
      
      // Encode the token for secure storage
      // In a real production app, we'd use a proper encryption method
      // This is a simple encoding for demonstration purposes
      console.log(`Saving ${type} token to database, token length:`, token.length);
      console.log(`Token first 5 chars:`, token.substring(0, 5));
      
      const tokenHash = Buffer.from(token).toString('base64');
      console.log(`Encoded token length:`, tokenHash.length);
      console.log(`Encoded token first 10 chars:`, tokenHash.substring(0, 10));
      
      // To verify encoding consistency, let's test decode it right away
      const decodedToken = Buffer.from(tokenHash, 'base64').toString();
      if (decodedToken !== token) {
        console.error("WARNING: Encoding/decoding mismatch detected!");
        console.log(`Original length: ${token.length}, Decoded length: ${decodedToken.length}`);
        console.log(`Original first 5: ${token.substring(0, 5)}, Decoded first 5: ${decodedToken.substring(0, 5)}`);
      } else {
        console.log("Encoding/decoding validation successful");
      }
      
      // Save the token in our database
      await storage.saveApiToken({
        service: type,
        tokenHash: tokenHash
      });
      
      // For backward compatibility, also set environment variables
      // This ensures existing code continues to work
      if (type === 'slack') {
        process.env.SLACK_BOT_TOKEN = token;
      } else if (type === 'openai') {
        process.env.OPENAI_API_KEY = token;
      } else if (type === 'asana') {
        process.env.ASANA_PAT = token;
      }
      
      res.json({ success: true, message: `${type} token updated successfully` });
    } catch (error) {
      console.error("Error updating API token:", error);
      res.status(500).json({ message: "Failed to update API token" });
    }
  });
  
  // Register API routes
  app.use("/api", apiRouter);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
