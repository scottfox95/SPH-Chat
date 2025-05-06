import express, { Express, Request, Response, NextFunction } from "express";
import { Server } from "http";
import multer from "multer";
import path from "path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { storage } from "./storage";
import { hashPassword, comparePassword } from "./auth";
import { validateEmail } from "./lib/validation";
import xlsx from "./lib/excel-parser";
import pdf from "./lib/pdf-parser";
import { isNodeProductionEnv } from "./lib/environment";
import { SlackWebClient } from "./lib/slack";
import { WebClient } from "@slack/web-api";
import { getChatbotResponse, generateWeeklySummary, generateProjectSummary, testOpenAIConnection } from "./lib/openai";
import { getDocument } from "./lib/document-processor";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getChatbotContext, formatTasksForChatbot, validateChatbotAccess, prepareChatbotMessagesAndPrompt } from "./lib/chatbot-helpers";
import { getAsanaToken, getAsanaProjectTasks, getAsanaAuthUrl, validateAsanaCode, getAsanaProjects } from "./lib/asana";
import { streamChatCompletion } from "./lib/chat-streaming";
import { handleStreamingEndpoint } from "./lib/streaming-endpoint";

// Define schemas for request validation
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  email: z.string().refine(validateEmail, {
    message: "Invalid email format",
  }),
});

const projectSchema = z.object({
  name: z.string().min(1),
});

const chatbotSchema = z.object({
  name: z.string().min(1),
  slackChannelId: z.string().min(1), 
  asanaProjectId: z.string().nullable(),
  asanaConnectionId: z.string().nullable(),
  projectId: z.number().nullable(),
  requireAuth: z.boolean().optional().default(false),
  systemPrompt: z.string().nullable().optional(),
  outputFormat: z.string().nullable().optional(),
});

const recipientSchema = z.object({
  email: z.string().refine(validateEmail, {
    message: "Invalid email format",
  }),
  chatbotId: z.number(),
});

const settingsSchema = z.object({
  openaiModel: z.string(),
  includeSourceDetails: z.boolean(),
  includeDateInSource: z.boolean(),
  includeUserInSource: z.boolean(),
  responseTemplate: z.string().nullable(),
  summaryPrompt: z.string().nullable(),
  smtpEnabled: z.boolean(),
  smtpHost: z.string().nullable(),
  smtpPort: z.number().nullable(),
  smtpUser: z.string().nullable(),
  smtpPassword: z.string().nullable(),
  emailFrom: z.string().nullable(),
});

const chatMessageSchema = z.object({
  message: z.string(),
  token: z.string().optional(),
  stream: z.boolean().optional()
});

// Configure file storage for document uploads
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = nanoid(8);
    cb(null, `${Date.now()}-${uniqueSuffix}-${file.originalname}`);
  },
});

// Create multer upload instance
const upload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB size limit
  },
});

// Initialize slack client
const slack = new SlackWebClient();

/**
 * Register API routes
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Import our dedicated streaming route
  const streamRouter = require('./routes/stream').default;
  
  // API router for authenticated endpoints
  const apiRouter = express.Router();
  
  // Register the streaming route directly with the api router
  apiRouter.use(streamRouter);
  
  // Simple health check route that doesn't require auth
  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // User login endpoint
  apiRouter.post("/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      const isPasswordValid = await comparePassword(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Create session
      req.login(user, (loginErr: Error) => {
        if (loginErr) {
          console.error("Error creating session:", loginErr);
          return res.status(500).json({ message: "Error creating session" });
        }
        
        // Log successful login
        console.log("Login successful");
        
        // Return user info (exclude password)
        const { password, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });
  
  // Get current user
  apiRouter.get("/user", (req, res) => {
    if (req.isAuthenticated()) {
      console.log("Auth check - session ID:", req.sessionID);
      console.log("Auth check - isAuthenticated:", req.isAuthenticated());
      console.log("Auth check - user:", req.user ? `ID: ${(req.user as any).id}, Username: ${(req.user as any).username}` : "No user");
      
      // Return user info (exclude password)
      const { password, ...userWithoutPassword } = req.user as any;
      res.json({ user: userWithoutPassword });
    } else {
      console.log("Auth check - not authenticated", req.sessionID || "No session");
      res.status(401).json({ message: "Not authenticated" });
    }
  });
  
  // User logout
  apiRouter.post("/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).json({ message: "Error during logout" });
      }
      
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      console.log("Auth check - session ID:", req.sessionID);
      console.log("Auth check - isAuthenticated:", req.isAuthenticated());
      console.log("Auth check - user:", req.user ? `ID: ${(req.user as any).id}, Username: ${(req.user as any).username}` : "No user");
      return next();
    }
    
    res.status(401).json({ message: "Not authenticated" });
  };
  
  // Get all projects
  apiRouter.get("/projects", isAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Error fetching projects" });
    }
  });
  
  // Create a new project
  apiRouter.post("/projects", isAuthenticated, async (req, res) => {
    try {
      const { name } = projectSchema.parse(req.body);
      const newProject = await storage.createProject({
        name,
        createdById: (req.user as any).id,
      });
      
      res.status(201).json(newProject);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ message: "Error creating project" });
    }
  });
  
  // Get all chatbots
  apiRouter.get("/chatbots", async (req, res) => {
    try {
      console.log("Fetching all chatbots from database");
      const chatbots = await storage.getChatbots();
      console.log(`Fetched chatbots count: ${chatbots.length}`);
      res.json(chatbots);
    } catch (error) {
      console.error("Error fetching chatbots:", error);
      res.status(500).json({ message: "Error fetching chatbots" });
    }
  });
  
  // Get a specific chatbot
  apiRouter.get("/chatbots/:id", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      console.log(`Fetching chatbot with id: ${chatbotId}`);
      const chatbot = await storage.getChatbot(chatbotId);
      
      if (!chatbot) {
        console.log("Chatbot found: No");
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      console.log("Chatbot found: Yes");
      res.json(chatbot);
    } catch (error) {
      console.error("Error fetching chatbot:", error);
      res.status(500).json({ message: "Error fetching chatbot" });
    }
  });
  
  // Create a new chatbot
  apiRouter.post("/chatbots", isAuthenticated, async (req, res) => {
    try {
      const chatbotData = chatbotSchema.parse(req.body);
      
      const newChatbot = await storage.createChatbot({
        ...chatbotData,
        createdById: (req.user as any).id,
      });
      
      res.status(201).json(newChatbot);
    } catch (error) {
      console.error("Error creating chatbot:", error);
      res.status(400).json({ message: "Error creating chatbot" });
    }
  });
  
  // Update a chatbot
  apiRouter.put("/chatbots/:id", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      const chatbotData = chatbotSchema.parse(req.body);
      
      const existingChatbot = await storage.getChatbot(chatbotId);
      
      if (!existingChatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      const updatedChatbot = await storage.updateChatbot(chatbotId, chatbotData);
      
      res.json(updatedChatbot);
    } catch (error) {
      console.error("Error updating chatbot:", error);
      res.status(400).json({ message: "Error updating chatbot" });
    }
  });
  
  // Delete a chatbot
  apiRouter.delete("/chatbots/:id", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      const existingChatbot = await storage.getChatbot(chatbotId);
      
      if (!existingChatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      await storage.deleteChatbot(chatbotId);
      
      res.json({ message: "Chatbot deleted successfully" });
    } catch (error) {
      console.error("Error deleting chatbot:", error);
      res.status(500).json({ message: "Error deleting chatbot" });
    }
  });

  // True token-by-token streaming endpoint
  apiRouter.post("/chatbots/:id/stream", async (req, res) => {
    // Use our dedicated streaming endpoint handler
    await handleStreamingEndpoint(req, res);
  });
  
  // Regular chat API endpoint
  apiRouter.post("/chatbots/:id/chat", async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      const { message, token, stream } = chatMessageSchema.parse(req.body);
      
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
      
      // Debug logging for document processing
      console.log(`Chatbot ${chatbotId} documents count: ${documents.length}`);
      if (documents.length > 0) {
        console.log(`First document preview: ${documents[0].substring(0, 100)}...`);
      } else {
        console.log(`No documents found for chatbot ${chatbotId}. Checking if documents exist in database...`);
        const dbDocuments = await storage.getDocuments(chatbotId);
        console.log(`Database documents count: ${dbDocuments.length}`);
        if (dbDocuments.length > 0) {
          console.log(`Database has documents but processing failed. First document: ${dbDocuments[0].originalName}`);
        }
      }
      
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
      // 1. Use chatbot-specific prompt if available
      // 2. Fall back to app-wide prompt from settings if available
      // 3. Use default prompt as last resort
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
      
      // Save user message - use token-based access, no need for user ID (public interface)
      const userMessage = await storage.createMessage({
        chatbotId,
        userId: req.user ? (req.user as any).id : null,
        content: message,
        isUserMessage: true,
        citation: null,
      });

      // If streaming is requested and this is an HTTP request (not WebSocket)
      if (stream === true) {
        // Set up SSE (Server-Sent Events)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        let fullContent = '';
        let citation = '';
        
        // Track the number of chunks being sent for streaming simulation
        let pendingChunks = 0;
        
        // Define the stream handler function
        const streamHandler = (chunk: string) => {
          // For large chunks, manually break them up into smaller pieces
          // to simulate more natural streaming
          if (chunk.length > 20) { // Only chunk large responses
            const words = chunk.split(' ');
            let buffer = '';
            const chunks = [];
            
            // Group words into small chunks
            for (let i = 0; i < words.length; i++) {
              buffer += words[i] + ' ';
              
              // Collect buffer every few words or at the end
              if (i % 3 === 2 || i === words.length - 1) {
                chunks.push(buffer.trim());
                fullContent += buffer;
                buffer = '';
              }
            }
            
            // Send chunks with progressive delay for streaming effect
            pendingChunks += chunks.length;
            chunks.forEach((chunkText, index) => {
              setTimeout(() => {
                res.write(`data: ${JSON.stringify({ content: chunkText + ' ' })}\n\n`);
                pendingChunks--;
              }, index * 30); // 30ms delay per chunk for smoother experience
            });
          } else {
            // For smaller chunks, send them as is
            res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            fullContent += chunk;
          }
        };
        
        try {
          // Call OpenAI with streaming
          const aiResponse = await getChatbotResponse(
            message,
            documents,
            [...slackMessages, ...asanaTasks],
            systemPrompt,
            chatbot.outputFormat,
            streamHandler // Pass the stream handler
          );
          
          // Update the full content and citation from the response
          if (aiResponse) {
            fullContent = aiResponse.content;
            citation = aiResponse.citation;
          }
          
          // Save the complete AI response to the database
          const botMessage = await storage.createMessage({
            chatbotId,
            userId: null,
            content: fullContent,
            isUserMessage: false,
            citation: citation,
          });
          
          // Wait for any pending chunks to be sent
          // Use a recursive function to check pendingChunks periodically
          const waitForPendingChunks = () => {
            if (pendingChunks <= 0) {
              // All chunks sent, now send completion event and end response
              res.write(`data: ${JSON.stringify({ done: true, messageId: botMessage.id })}\n\n`);
              res.end();
            } else {
              // Some chunks are still being sent, wait and check again
              console.log(`Waiting for ${pendingChunks} pending chunks to complete...`);
              setTimeout(waitForPendingChunks, 100);
            }
          };
          
          waitForPendingChunks();
        } catch (error) {
          console.error("Error in streaming response:", error);
          
          if (!res.headersSent) {
            res.status(500).json({ message: "Error generating response" });
          } else {
            res.write(`data: ${JSON.stringify({ error: "Error generating response" })}\n\n`);
            res.end();
          }
        }
      } else {
        // Handle regular non-streaming requests
        const aiResponse = await getChatbotResponse(
          message,
          documents,
          [...slackMessages, ...asanaTasks],
          systemPrompt,
          chatbot.outputFormat
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
          message: aiResponse.content,
          citation: aiResponse.citation,
          messageId: botMessage.id
        });
      }
    } catch (error) {
      console.error("Error in chat endpoint:", error);
      res.status(500).json({ message: "Error generating response" });
    }
  });

  // Mount API router
  app.use("/api", apiRouter);
  
  // Create HTTP server
  const httpServer = app.listen(5000, () => {
    console.log(`serving on port 5000`);
  });
  
  return httpServer;
}