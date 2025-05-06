import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { storage } from "./storage";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { upload } from "./middleware/multer";
import { z } from "zod";
import { 
  loginSchema, 
  chatMessageSchema, 
  addEmailRecipientSchema, 
  addAsanaProjectSchema,
  addProjectEmailRecipientSchema,
  updateSettingsSchema,
  emailSettingsSchema,
  OPENAI_MODELS
} from "@shared/schema";
import { getChatbotResponse, generateWeeklySummary, generateProjectSummary, testOpenAIConnection } from "./lib/openai";
import { streamChatCompletion } from "./lib/chat-streaming";
import { 
  getFormattedSlackMessages, 
  getWeeklySlackMessages, 
  testSlackConnection, 
  validateSlackChannel,
  listAccessibleChannels,
  sendProjectSummaryToSlack,
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
import { getChatbotContext, clearDocumentCache, clearAllDocumentCache } from "./lib/vector-storage";
import { sendSummaryEmail, sendProjectSummaryEmail } from "./lib/email";
import * as fs from "fs";
import { nanoid } from "nanoid";
import { format } from "date-fns";
import { setupAuth } from "./auth";
import { hashPassword } from "./lib/password-utils";
import { asyncHandler } from "./lib/api-utils";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server on a specific path to avoid conflicts with Vite's HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Serve static files from the public directory
  app.use(express.static(path.join(process.cwd(), 'public')));
  
  // WebSocket connection handler
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message received:', data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Set up authentication
  const { isAuthenticated } = setupAuth(app);
  
  // Diagnostic endpoints
  app.get("/api/system/db-diagnostic", async (req, res) => {
    // Database connection diagnostic endpoint
    try {
      const dbUrl = process.env.DATABASE_URL || 'Not set';
      // Only show a masked URL for security
      const maskedUrl = dbUrl !== 'Not set'
        ? `${dbUrl.split('://')[0]}://${dbUrl.split('@')[1] || '[masked]'}`
        : 'Not set';
      
      // Test connection
      const connectionTest = await storage.testConnection?.() || { connected: false, error: "Method not available" };
      
      return res.json({
        connected: connectionTest.connected,
        databaseUrl: maskedUrl,
        environment: process.env.NODE_ENV || 'unknown',
        poolStats: storage.getPoolStats?.() || { total: 'unknown', idle: 'unknown' }
      });
    } catch (error) {
      console.error("Error in db diagnostic:", error);
      return res.status(500).json({
        connected: false,
        error: 'Database diagnostic failed',
        environment: process.env.NODE_ENV || 'unknown'
      });
    }
  });

  app.get("/api/system/auth-diagnostic", async (req, res) => {
    // Diagnostic endpoint that works even when auth is broken
    try {
      // Get basic auth info without exposing sensitive data
      const authStatus = {
        authenticated: req.isAuthenticated(),
        sessionID: req.sessionID,
        environment: process.env.NODE_ENV || 'development',
        // Get cookie information (safely) for debugging
        cookieInfo: req.headers.cookie ? {
          present: true,
          sessionCookiePresent: req.headers.cookie.includes('connect.sid='),
          count: req.headers.cookie.split(';').length,
          names: req.headers.cookie.split(';').map(c => c.trim().split('=')[0])
        } : { present: false },
        userInfo: req.user ? {
          exists: true,
          id: (req.user as any).id,
          username: (req.user as any).username,
          role: (req.user as any).role,
        } : { exists: false },
        headers: {
          host: req.headers.host,
          origin: req.headers.origin || null,
          referer: req.headers.referer || null,
        },
        sessionStore: {
          type: storage.sessionStore ? storage.sessionStore.constructor.name : 'Unknown',
        },
        databaseInfo: {
          poolStats: typeof storage.getPoolStats === 'function' ? storage.getPoolStats() : 'Not available',
          connectionStatus: typeof storage.testConnection === 'function' ? 'Available' : 'Not available',
        },
        timestamp: new Date().toISOString()
      };
      
      // Return diagnostic info
      res.json(authStatus);
    } catch (error) {
      // Even if there's an error, try to return something useful
      res.status(500).json({
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // API routes
  const apiRouter = express.Router();
  
  // User management routes
  apiRouter.get("/users", requireAdmin, asyncHandler(async (req, res) => {
    const users = await storage.getUsers();
    // Remove password from the response
    const sanitizedUsers = users.map(({ password, ...user }) => user);
    res.json(sanitizedUsers);
  }));
  
  apiRouter.get("/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userData } = user;
      res.json(userData);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  apiRouter.post("/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, displayName, initial, role } = req.body;
      
      if (!username || !password || !displayName || !initial) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        displayName,
        initial,
        role: role || "user"
      });
      
      // Remove password from response
      const { password: _, ...userData } = user;
      res.status(201).json(userData);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  apiRouter.put("/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { username, password, displayName, initial, role } = req.body;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If username is being changed, check if it already exists
      if (username && username !== user.username) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }
      
      // Prepare update data
      const updateData: Partial<typeof req.body> = {};
      if (username) updateData.username = username;
      if (displayName) updateData.displayName = displayName;
      if (initial) updateData.initial = initial;
      if (role) updateData.role = role;
      
      // Handle password update separately
      if (password) {
        updateData.password = await hashPassword(password);
      }
      
      const updatedUser = await storage.updateUser(id, updateData);
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user" });
      }
      
      // Remove password from response
      const { password: _, ...userData } = updatedUser;
      res.json(userData);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  apiRouter.delete("/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if it's the admin user (id 1)
      if (id === 1) {
        return res.status(403).json({ message: "Cannot delete the admin user" });
      }
      
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: "User not found or could not be deleted" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  
  // User-Project assignment routes
  apiRouter.get("/users/:userId/projects", requireAdmin, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const userProjects = await storage.getUserProjects(userId);
    res.json(userProjects);
  }));
  
  apiRouter.post("/users/:userId/projects", requireAdmin, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ message: "Project ID is required" });
    }
    
    // Check if user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if project exists
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    // Check if assignment already exists
    const userProjects = await storage.getUserProjects(userId);
    const existingAssignment = userProjects.find(up => up.projectId === projectId);
    
    if (existingAssignment) {
      return res.status(400).json({ message: "User is already assigned to this project" });
    }
    
    const userProject = await storage.assignUserToProject(userId, projectId);
    res.status(201).json(userProject);
  }));
  
  apiRouter.delete("/users/:userId/projects/:projectId", requireAdmin, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const projectId = parseInt(req.params.projectId);
    
    // Check if user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if project exists
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    const success = await storage.removeUserFromProject(userId, projectId);
    
    if (!success) {
      return res.status(404).json({ message: "Assignment not found or could not be deleted" });
    }
    
    res.json({ success: true });
  }));
  
  // Project management routes
  apiRouter.get("/projects", isAuthenticated, asyncHandler(async (req, res) => {
    // Get projects based on user access level
    const userId = (req.user as Express.User).id;
    const projects = await storage.getUserAccessibleProjects(userId);
    res.json(projects);
  }));
  
  apiRouter.get("/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Check if user has admin role
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "admin";
      
      // Get the project
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // If not admin, check if user is assigned to this project
      if (!isAdmin) {
        const accessibleProjects = await storage.getUserAccessibleProjects(userId);
        const hasAccess = accessibleProjects.some(p => p.id === id);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have permission to access this project" });
        }
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });
  
  apiRouter.post("/projects", isAuthenticated, async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Project name is required" });
      }
      
      // Ensure we have a valid user before proceeding
      if (!req.user || !(req.user as Express.User).id) {
        return res.status(401).json({ 
          message: "Authentication required",
          details: "No valid user session found. Please log in again."
        });
      }
      
      const userId = (req.user as Express.User).id;
      
      const project = await storage.createProject({
        name,
        description,
        createdById: userId
      });
      
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });
  
  apiRouter.put("/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description } = req.body;
      
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Prepare update data
      const updateData: Partial<typeof req.body> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      
      const updatedProject = await storage.updateProject(id, updateData);
      
      if (!updatedProject) {
        return res.status(500).json({ message: "Failed to update project" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });
  
  apiRouter.delete("/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const success = await storage.deleteProject(id);
      
      if (!success) {
        return res.status(404).json({ message: "Project not found or could not be deleted" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });
  
  apiRouter.get("/projects/:id/chatbots", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const chatbots = await storage.getProjectChatbots(projectId);
      res.json(chatbots);
    } catch (error) {
      console.error("Error fetching project chatbots:", error);
      res.status(500).json({ message: "Failed to fetch project chatbots" });
    }
  });
  
  // Chatbot routes - filter chatbots based on user permissions
  apiRouter.get("/chatbots", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as Express.User).id;
      const chatbots = await storage.getUserAccessibleChatbots(userId);
      res.json(chatbots);
    } catch (error) {
      console.error("Error fetching chatbots:", error);
      res.status(500).json({ message: "Failed to fetch chatbots" });
    }
  });
  
  apiRouter.get("/chatbots/:id", isAuthenticated, async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Check if user has admin role
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "admin";
      
      // Get the chatbot
      const chatbot = await storage.getChatbot(chatbotId);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // If not admin, check if user has access to this chatbot
      if (!isAdmin && chatbot.projectId) {
        const accessibleChatbots = await storage.getUserAccessibleChatbots(userId);
        const hasAccess = accessibleChatbots.some(c => c.id === chatbotId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have permission to access this chatbot" });
        }
      }
      
      res.json(chatbot);
    } catch (error) {
      console.error("Error fetching chatbot:", error);
      res.status(500).json({ message: "Failed to fetch chatbot" });
    }
  });
  
  apiRouter.post("/chatbots", isAuthenticated, async (req, res) => {
    const isProductionEnv = process.env.NODE_ENV === 'production';
    console.log(`POST /api/chatbots received in ${process.env.NODE_ENV} environment`);
    
    try {
      console.log("POST /api/chatbots received with body:", JSON.stringify(req.body, null, 2));
      
      const { name, slackChannelId, projectId } = req.body;
      
      if (!name || !slackChannelId) {
        console.warn("Missing required fields in request:", req.body);
        return res.status(400).json({ message: "Name and Slack channel ID are required" });
      }
      
      // Validate projectId if provided
      if (projectId) {
        try {
          const project = await storage.getProject(parseInt(projectId));
          if (!project) {
            console.warn(`Project with ID ${projectId} not found`);
            return res.status(400).json({ message: "Specified project does not exist" });
          }
        } catch (projectError) {
          console.warn(`Error validating project ID ${projectId}:`, projectError);
          return res.status(400).json({ message: "Invalid project ID format" });
        }
      }
      
      // Try to validate the Slack channel ID, but continue even if validation fails
      let channelValidation: { valid: boolean; error?: string; name?: string; isPrivate?: boolean } = { valid: true };
      try {
        console.log("Attempting to validate Slack channel:", slackChannelId);
        channelValidation = await validateSlackChannel(slackChannelId);
        
        // Log result but don't block creation if validation fails
        if (!channelValidation.valid) {
          console.warn(`Slack channel validation failed but continuing: ${channelValidation.error || 'Unknown error'}`);
        } else {
          console.log("Slack channel validation succeeded:", channelValidation);
        }
      } catch (error) {
        console.warn("Slack validation error but continuing with chatbot creation:", error);
      }
      
      // Special handling for production environment
      let userId = 0;
      
      // Ensure we have a valid user before proceeding
      if (!req.user || !(req.user as Express.User).id) {
        console.warn("No authenticated user found in request. Session may be invalid.");
        
        if (isProductionEnv) {
          console.log("Production environment: Allowing chatbot creation without authentication");
          
          // In production, try to find an admin user to use as creator
          try {
            const users = await storage.getUsers();
            console.log(`Found ${users.length} users in database`);
            
            // Try to find admin first, then fall back to any user
            const adminUser = users.find(u => u.role === 'admin');
            const firstUser = users.length > 0 ? users[0] : null;
            
            if (adminUser) {
              console.log("Using admin user as creator:", adminUser.id, adminUser.username);
              userId = adminUser.id;
            } else if (firstUser) {
              console.log("Using first available user as creator:", firstUser.id, firstUser.username);
              userId = firstUser.id;
            } else {
              console.error("No users found in database to assign as creator");
              return res.status(400).json({ 
                message: "Cannot create chatbot",
                details: "No users exist in the system to assign as creator"
              });
            }
          } catch (userError) {
            console.error("Error finding users:", userError);
            return res.status(500).json({ 
              message: "Database error", 
              details: "Could not access user database"
            });
          }
        } else {
          // In development, still require authentication
          return res.status(401).json({ 
            message: "Authentication required",
            details: "No valid user session found. Please log in again."
          });
        }
      } else {
        // Normal case - use the authenticated user
        const user = req.user as Express.User;
        userId = user.id;
        console.log("Using authenticated user as creator:", userId);
      }
      
      if (userId === 0) {
        return res.status(400).json({ 
          message: "Cannot create chatbot",
          details: "Could not determine a valid creator for the chatbot"
        });
      }
      
      try {
        console.log("Creating chatbot with user ID:", userId);
        
        const chatbotData = {
          name,
          slackChannelId,
          createdById: userId,
          isActive: true,
          requireAuth: false,
          projectId: projectId ? parseInt(projectId) : undefined,
        };
        
        console.log("Chatbot creation data:", JSON.stringify(chatbotData, null, 2));
        const chatbot = await storage.createChatbot(chatbotData);
        
        console.log("Successfully created chatbot:", JSON.stringify(chatbot, null, 2));
        res.status(201).json(chatbot);
      } catch (storageError) {
        console.error("Database error creating chatbot:", storageError);
        return res.status(500).json({ 
          message: "Database error",
          details: storageError instanceof Error ? storageError.message : "Unknown database error"
        });
      }
    } catch (error) {
      console.error("Unexpected error creating chatbot:", error);
      res.status(500).json({ 
        message: "Failed to create chatbot", 
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  apiRouter.put("/chatbots/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, slackChannelId, asanaProjectId, isActive, requireAuth, projectId, systemPrompt, outputFormat } = req.body;
      
      console.log(`Updating chatbot ${id} with data:`, req.body);
      
      const chatbot = await storage.getChatbot(id);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // If a new Slack channel ID is provided, try to validate it but don't block updates
      if (slackChannelId && slackChannelId !== chatbot.slackChannelId) {
        try {
          const channelValidation = await validateSlackChannel(slackChannelId);
          
          // Just log warnings but continue with the update
          if (!channelValidation.valid) {
            console.warn(`Slack channel validation failed but continuing with update: ${channelValidation.error}`);
          }
        } catch (error) {
          console.warn("Slack channel validation error but continuing with update:", error);
        }
      }
      
      // If a new Asana project ID is provided, try to validate it but don't block updates
      if (asanaProjectId && asanaProjectId !== chatbot.asanaProjectId) {
        try {
          const projectResponse = await getAsanaProjectTasks(asanaProjectId, false);
          
          if (!projectResponse.success) {
            console.warn(`Asana project validation failed but continuing with update: ${projectResponse.error}`);
          }
        } catch (error) {
          console.warn("Asana project validation error but continuing with update:", error);
        }
      }
      
      // Handle project ID setting/unsetting specifically
      let updatedProjectId = chatbot.projectId;
      if (projectId !== undefined) {
        updatedProjectId = projectId; // This can be null to unassign from project
        console.log(`Updating chatbot ${id} projectId to:`, projectId);
      }
      
      const updatedChatbot = await storage.updateChatbot(id, {
        name: name || chatbot.name,
        slackChannelId: slackChannelId || chatbot.slackChannelId,
        asanaProjectId: asanaProjectId !== undefined ? asanaProjectId : chatbot.asanaProjectId,
        isActive: isActive !== undefined ? isActive : chatbot.isActive,
        requireAuth: requireAuth !== undefined ? requireAuth : chatbot.requireAuth,
        createdById: chatbot.createdById,
        projectId: updatedProjectId,
        systemPrompt: systemPrompt !== undefined ? systemPrompt : chatbot.systemPrompt,
        outputFormat: outputFormat !== undefined ? outputFormat : chatbot.outputFormat,
        // publicToken is now a UUID generated by the database and should not be updated
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
      
      // Clear document cache for this specific chatbot
      clearDocumentCache(chatbotId);
      
      // Also clear the global document cache to ensure consistency
      clearAllDocumentCache();
      
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
      
      // Get document directly by ID using our new method
      const document = await storage.getDocument(id);
      
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
      
      // Clear document cache for this specific chatbot
      clearDocumentCache(document.chatbotId);
      
      // Also clear the global document cache to ensure consistency
      clearAllDocumentCache();
      
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
  
  // Project Email recipient routes
  apiRouter.get("/projects/:id/recipients", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      const recipients = await storage.getProjectEmailRecipients(projectId);
      
      res.json(recipients);
    } catch (error) {
      console.error("Error fetching project recipients:", error);
      res.status(500).json({ message: "Failed to fetch project recipients" });
    }
  });
  
  apiRouter.post("/projects/:id/recipients", isAuthenticated, async (req, res) => {
    try {
      const data = addProjectEmailRecipientSchema.parse({
        ...req.body,
        projectId: parseInt(req.params.id),
      });
      
      const recipient = await storage.createProjectEmailRecipient(data);
      
      res.status(201).json(recipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error adding project recipient:", error);
      res.status(500).json({ message: "Failed to add project recipient" });
    }
  });
  
  apiRouter.delete("/project-recipients/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const success = await storage.deleteProjectEmailRecipient(id);
      
      if (!success) {
        return res.status(404).json({ message: "Project recipient not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project recipient:", error);
      res.status(500).json({ message: "Failed to delete project recipient" });
    }
  });
  
  // Summary routes
  apiRouter.get("/summaries", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as Express.User).id;
      
      // Get only chatbots the user has access to
      const chatbots = await storage.getUserAccessibleChatbots(userId);
      
      // Create a map of chatbot IDs to names for reference
      const chatbotNames = new Map(
        chatbots.map(chatbot => [chatbot.id, chatbot.name])
      );
      
      // Get all summaries from accessible chatbots
      const allSummariesPromises = chatbots.map(chatbot => 
        storage.getSummaries(chatbot.id)
      );
      
      const allSummariesArrays = await Promise.all(allSummariesPromises);
      
      // Flatten the array of arrays and add chatbot name to each summary
      const summaries = allSummariesArrays
        .flat()
        .map(summary => ({
          ...summary,
          chatbotName: chatbotNames.get(summary.chatbotId) || "Unknown"
        }));
      
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ message: "Failed to fetch summaries" });
    }
  });
  
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
      
      // Save user message - use token-based access, no need for user ID (public interface)
      const userMessage = await storage.createMessage({
        chatbotId,
        userId: null, // No user ID for token-based public access
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
              // Some chunks still pending, check again after a short delay
              console.log(`Waiting for ${pendingChunks} pending chunks to complete...`);
              setTimeout(waitForPendingChunks, 100);
            }
          };
          
          // Start waiting for chunks
          waitForPendingChunks();
        } catch (error) {
          console.error("Error in streaming mode:", error);
          res.write(`data: ${JSON.stringify({ error: "Error generating response" })}\n\n`);
          res.end();
        }
      } else {
        // Non-streaming mode (original behavior)
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
          userMessage,
          botMessage,
        });
      }
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
          bot: authTestResult.bot_id,
          scopes: [] // Will be populated if available
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
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // List Asana projects from workspace
  apiRouter.get("/system/asana-projects", async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      const offset = req.query.offset as string | undefined;
      
      if (!workspaceId) {
        return res.status(400).json({ message: "Workspace ID is required" });
      }
      
      const result = await getAsanaProjects(workspaceId, offset);
      res.json(result);
    } catch (error) {
      console.error("Error listing Asana projects:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to list Asana projects",
        details: error instanceof Error ? error.message : "Unknown error"
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
        details: error instanceof Error ? error.message : "Unknown error"
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
        details: error instanceof Error ? error.message : "Unknown error"
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
  
  // Email settings specific endpoint
  apiRouter.put("/settings/email", isAuthenticated, async (req, res) => {
    try {
      const data = emailSettingsSchema.parse(req.body);
      
      // Get current settings first
      const currentSettings = await storage.getSettings();
      
      // Update only email settings
      const settings = await storage.updateSettings({
        ...currentSettings,
        smtpEnabled: data.smtpEnabled,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUser: data.smtpUser,
        smtpPass: data.smtpPass,
        smtpFrom: data.smtpFrom
      });
      
      // Update environment variables so they take effect immediately
      // without requiring a server restart
      if (data.smtpEnabled && data.smtpHost && data.smtpUser && data.smtpPass) {
        process.env.SMTP_HOST = data.smtpHost;
        process.env.SMTP_PORT = data.smtpPort || "587";
        process.env.SMTP_USER = data.smtpUser;
        process.env.SMTP_PASS = data.smtpPass;
        if (data.smtpFrom) {
          process.env.SMTP_FROM = data.smtpFrom;
        }
        
        // Log successful config
        console.log("Email settings updated. SMTP config:", {
          host: data.smtpHost,
          port: data.smtpPort,
          user: data.smtpUser,
          from: data.smtpFrom
        });
      } else if (!data.smtpEnabled) {
        // Clear env vars if email is disabled
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_PORT;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        delete process.env.SMTP_FROM;
        
        console.log("Email settings disabled");
      }
      
      res.json({
        success: true,
        message: "Email settings updated successfully"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error updating email settings:", error);
      res.status(500).json({ message: "Failed to update email settings" });
    }
  });
  
  // Test email connection
  apiRouter.get("/system/test-email", isAuthenticated, async (req, res) => {
    try {
      // Get optional test email from query param
      const testToEmail = req.query.email as string || '';
      
      // Get the settings to check if SMTP is configured
      const settings = await storage.getSettings();
      
      if (!settings?.smtpEnabled || !settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
        return res.json({
          connected: false,
          error: "SMTP settings are not configured or not enabled"
        });
      }
      
      // Get user to send test email to if no test email provided
      let userEmail = testToEmail;
      
      if (!userEmail) {
        const userId = (req.user as Express.User).id;
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.json({
            connected: false,
            error: "User not found and no test email provided. Add ?email=test@example.com to test."
          });
        }
        
        // Get the username as email or use a fallback
        userEmail = user.username.includes('@') ? user.username : `${user.username}@example.com`;
      }
      
      const fromAddress = settings.smtpFrom || '"SPH ChatBot" <homebuilder@example.com>';
      
      // Send a test email using nodemailer directly instead of sendSummaryEmail
      try {
        // Create a simple HTML email
        const testEmail = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #D2B48C;">Email Setup Test</h2>
            <p>This is a test email from your SPH ChatBot application.</p>
            <p>The email configuration is working correctly!</p>
            <p>You can now use email notifications for weekly summaries.</p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        `;
        
        // Import the module directly to avoid ESM issues
        const emailModule = await import('./lib/email');
        
        // Get the transporter
        const transporter = await emailModule.getTransporter();
        
        // Send the email directly 
        const info = await transporter.sendMail({
          from: fromAddress,
          to: userEmail,
          subject: "SPH ChatBot - Email Test",
          html: testEmail,
        });
        
        console.log("Test email sent:", info.messageId);
        res.json({
          connected: true,
          message: `Test email sent successfully to ${userEmail}`,
          messageId: info.messageId
        });
      } catch (emailError) {
        console.error("Error sending test email:", emailError);
        res.json({
          connected: false,
          error: "Error sending test email: " + (emailError instanceof Error ? emailError.message : "Unknown error")
        });
      }
    } catch (error) {
      console.error("Error testing email connection:", error);
      res.json({
        connected: false,
        error: "Error testing email connection: " + (error instanceof Error ? error.message : "Unknown error")
      });
    }
  });
  
  // Get all Asana projects (with pagination support)
  apiRouter.get("/system/all-asana-projects", isAuthenticated, async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      
      if (!workspaceId) {
        return res.status(400).json({ message: "Workspace ID is required" });
      }
      
      // Fetch all projects using pagination
      let allProjects: { id: string; name: string }[] = [];
      let offset: string | undefined = undefined;
      let hasMore = true;
      
      while (hasMore) {
        const result = await getAsanaProjects(workspaceId, offset);
        
        if (!result.success) {
          return res.status(400).json({ 
            success: false, 
            error: result.error || "Failed to fetch Asana projects" 
          });
        }
        
        if (result.projects && result.projects.length > 0) {
          allProjects = [...allProjects, ...result.projects];
        }
        
        // Check if there are more pages
        if (result.next_page && result.next_page.offset) {
          offset = result.next_page.offset;
        } else {
          hasMore = false;
        }
      }
      
      // Sort projects alphabetically by name
      allProjects.sort((a, b) => a.name.localeCompare(b.name));
      
      res.json({
        success: true,
        projectCount: allProjects.length,
        projects: allProjects
      });
    } catch (error) {
      console.error("Error fetching all Asana projects:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch all Asana projects",
        details: error instanceof Error ? error.message : "Unknown error"
      });
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
  
  // System status endpoints
  apiRouter.get("/system/health", async (req, res) => {
    res.status(200).json({ 
      status: "ok", 
      time: new Date().toISOString(), 
      environment: process.env.NODE_ENV || 'development' 
    });
  });
  
  // Basic database health check endpoint
  apiRouter.get("/system/db-status", async (req, res) => {
    try {
      // Import the testDatabaseConnection function
      const { testDatabaseConnection } = await import('./db');
      
      // Check database connection
      const dbStatus = await testDatabaseConnection();
      
      // Include app version and environment info
      const systemInfo = {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        database: dbStatus
      };
      
      // Return status based on database connection
      if (dbStatus.connected) {
        res.status(200).json(systemInfo);
      } else {
        res.status(500).json(systemInfo);
      }
    } catch (error) {
      console.error("Error checking database health:", error);
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown database error",
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // Project summary routes
  apiRouter.get("/projects/:id/summaries", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      // Get the project summaries
      const summaries = await storage.getProjectSummaries(projectId);
      
      // Get the project name for reference
      const project = await storage.getProject(projectId);
      const projectName = project ? project.name : "Unknown Project";
      
      // Add project name to each summary
      const summariesWithProjectName = summaries.map(summary => ({
        ...summary,
        projectName
      }));
      
      res.json(summariesWithProjectName);
    } catch (error) {
      console.error("Error fetching project summaries:", error);
      res.status(500).json({ message: "Failed to fetch project summaries" });
    }
  });
  
  apiRouter.post("/projects/:id/generate-summary", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { slackChannelId } = req.body;
      
      // Verify the project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Get all chatbots for this project
      const chatbots = await storage.getProjectChatbots(projectId);
      if (chatbots.length === 0) {
        return res.status(400).json({ message: "No chatbots found for this project" });
      }
      
      // Prepare data from all chatbots in the project
      const chatbotSummaries = [];
      const allProjectMessages = [];
      let slackSent = false;
      
      // Generate individual summaries for each chatbot if they don't exist
      for (const chatbot of chatbots) {
        // Get messages for this chatbot
        const slackMessages = await getWeeklySlackMessages(chatbot.slackChannelId);
        
        // Store messages for the overall summary
        allProjectMessages.push({
          chatbotName: chatbot.name,
          messages: slackMessages.map(msg => `${msg.user}: ${msg.text}`)
        });
        
        // Check if we already have a summary for this week for this chatbot
        const existingSummaries = await storage.getSummaries(chatbot.id);
        const currentWeek = format(new Date(), "yyyy-'W'ww");
        
        let chatbotSummaryContent;
        
        // Use existing summary if available for this week
        const existingSummary = existingSummaries.find(s => s.week === currentWeek);
        if (existingSummary) {
          chatbotSummaryContent = existingSummary.content;
        } else if (slackMessages.length > 0) {
          // Generate a new summary if we have messages
          const formattedMessages = slackMessages.map(msg => `${msg.user}: ${msg.text}`);
          chatbotSummaryContent = await generateWeeklySummary(formattedMessages, chatbot.name);
          
          // Save the individual chatbot summary
          await storage.createSummary({
            chatbotId: chatbot.id,
            content: chatbotSummaryContent,
            week: currentWeek,
          });
        } else {
          // Skip chatbots with no messages
          continue;
        }
        
        chatbotSummaries.push({
          chatbotName: chatbot.name,
          content: chatbotSummaryContent
        });
      }
      
      if (chatbotSummaries.length === 0) {
        return res.status(400).json({ message: "No summaries could be generated for any chatbots in this project" });
      }
      
      // Generate the combined project summary
      const projectSummaryContent = await generateProjectSummary(
        project.name,
        chatbotSummaries,
        allProjectMessages
      );
      
      // Create week identifier
      const week = format(new Date(), "yyyy-'W'ww");
      
      // Save the project summary
      const projectSummary = await storage.createProjectSummary({
        projectId,
        content: projectSummaryContent,
        week,
        slackChannelId: slackChannelId || null
      });
      
      // Send to Slack if a channel ID was provided
      let slackResult = null;
      if (slackChannelId) {
        slackResult = await sendProjectSummaryToSlack(
          slackChannelId,
          project.name,
          projectSummaryContent,
          chatbots.length
        );
      }
      
      // Send email to project recipients if configured
      const projectEmailRecipients = await storage.getProjectEmailRecipients(projectId);
      let emailResult = { success: false, message: "No email recipients configured" };
      
      if (projectEmailRecipients.length > 0) {
        const subject = `Weekly Project Summary: ${project.name} - Week of ${format(new Date(), 'MMMM d, yyyy')}`;
        emailResult = await sendProjectSummaryEmail(projectId, subject, projectSummaryContent);
      }
      
      res.json({
        summary: projectSummary,
        summariesCount: chatbotSummaries.length,
        slackSent: !!slackResult,
        emailSent: emailResult.success,
        emailDetails: emailResult,
      });
    } catch (error) {
      console.error("Error generating project summary:", error);
      res.status(500).json({ message: "Failed to generate project summary" });
    }
  });
  
  // Comprehensive database verification endpoint
  apiRouter.get("/system/db-verify", async (req, res) => {
    try {
      // Import the verifyDatabaseSetup function
      const { verifyDatabaseSetup } = await import('./db');
      
      // Perform comprehensive database verification
      const verificationResult = await verifyDatabaseSetup();
      
      // Add system info to the result
      const systemInfo = {
        appVersion: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        platform: process.platform,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        verification: verificationResult
      };
      
      // Return appropriate status code based on verification result
      if (verificationResult.success) {
        res.status(200).json(systemInfo);
      } else {
        // Still return 200 but with success: false to allow the frontend to handle it
        res.status(200).json(systemInfo);
      }
    } catch (error) {
      console.error("Error verifying database setup:", error);
      res.status(500).json({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown database verification error",
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // Register API routes
  app.use("/api", apiRouter);
  
  // Return the HTTP server that was created at the top of this function
  return httpServer;
}
