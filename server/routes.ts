import express, { type Express } from "express";
import session from "express-session";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { upload } from "./middleware/multer";
import { z } from "zod";
import { loginSchema, chatMessageSchema, addEmailRecipientSchema } from "@shared/schema";
import { getChatbotResponse, generateWeeklySummary } from "./lib/openai";
import { getFormattedSlackMessages, getWeeklySlackMessages } from "./lib/slack";
import { processDocument } from "./lib/document-processor";
import { getChatbotContext, clearDocumentCache } from "./lib/vector-storage";
import { sendSummaryEmail } from "./lib/email";
import * as fs from "fs";
import { nanoid } from "nanoid";
import { format } from "date-fns";
import MemoryStore from "memorystore";

const SessionStore = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "homebuildbot-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        secure: process.env.NODE_ENV === "production",
      },
      store: new SessionStore({
        checkPeriod: 86400000, // 24 hours
      }),
    })
  );

  // API routes
  const apiRouter = express.Router();
  
  // Auth routes
  apiRouter.post("/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(data.username);
      
      if (!user || user.password !== data.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      
      return res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        initial: user.initial,
        role: user.role,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  apiRouter.post("/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
  
  apiRouter.get("/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    return res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      initial: user.initial,
      role: user.role,
    });
  });
  
  // Chatbot routes
  apiRouter.get("/chatbots", async (req, res) => {
    const chatbots = await storage.getChatbots();
    res.json(chatbots);
  });
  
  apiRouter.get("/chatbots/:id", async (req, res) => {
    const chatbot = await storage.getChatbot(parseInt(req.params.id));
    
    if (!chatbot) {
      return res.status(404).json({ message: "Chatbot not found" });
    }
    
    res.json(chatbot);
  });
  
  apiRouter.post("/chatbots", async (req, res) => {
    try {
      const { name, slackChannelId } = req.body;
      
      if (!name || !slackChannelId) {
        return res.status(400).json({ message: "Name and Slack channel ID are required" });
      }
      
      const chatbot = await storage.createChatbot({
        name,
        slackChannelId,
        createdById: 1, // Default to user ID 1 since authentication is removed
        isActive: true,
        requireAuth: false,
      });
      
      res.status(201).json(chatbot);
    } catch (error) {
      console.error("Error creating chatbot:", error);
      res.status(500).json({ message: "Failed to create chatbot" });
    }
  });
  
  apiRouter.put("/chatbots/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, slackChannelId, isActive, requireAuth } = req.body;
      
      const chatbot = await storage.getChatbot(id);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      const updatedChatbot = await storage.updateChatbot(id, {
        name: name || chatbot.name,
        slackChannelId: slackChannelId || chatbot.slackChannelId,
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
  
  apiRouter.delete("/chatbots/:id", async (req, res) => {
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
  
  apiRouter.post("/chatbots/:id/documents", upload.single("file"), async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const { filename, originalname, mimetype } = req.file;
      
      const document = await storage.createDocument({
        chatbotId,
        filename,
        originalName: originalname,
        fileType: mimetype,
        uploadedById: req.session.userId as number,
      });
      
      // Clear document cache for this chatbot
      clearDocumentCache(chatbotId);
      
      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });
  
  apiRouter.delete("/documents/:id", async (req, res) => {
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
  apiRouter.get("/chatbots/:id/recipients", async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      const recipients = await storage.getEmailRecipients(chatbotId);
      
      res.json(recipients);
    } catch (error) {
      console.error("Error fetching recipients:", error);
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });
  
  apiRouter.post("/chatbots/:id/recipients", async (req, res) => {
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
  
  apiRouter.delete("/recipients/:id", async (req, res) => {
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
  apiRouter.get("/chatbots/:id/summaries", async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      
      const summaries = await storage.getSummaries(chatbotId);
      
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ message: "Failed to fetch summaries" });
    }
  });
  
  apiRouter.post("/chatbots/:id/generate-summary", async (req, res) => {
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
      
      // Check if token is valid or user is authenticated
      const chatbot = await storage.getChatbot(chatbotId);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // Check authentication
      if (chatbot.requireAuth && !req.session.userId && chatbot.publicToken !== token) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const messages = await storage.getMessages(chatbotId);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  apiRouter.post("/chatbots/:id/chat", async (req, res) => {
    try {
      const chatbotId = parseInt(req.params.id);
      const { message, token } = chatMessageSchema.parse(req.body);
      
      // Check if token is valid or user is authenticated
      const chatbot = await storage.getChatbot(chatbotId);
      
      if (!chatbot) {
        return res.status(404).json({ message: "Chatbot not found" });
      }
      
      // Check authentication
      if (chatbot.requireAuth && !req.session.userId && chatbot.publicToken !== token) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Get the system prompt
      const systemPrompt = `You are a helpful assistant named HomeBuildBot assigned to the ${chatbot.name} homebuilding project. Your role is to provide project managers and executives with accurate, up-to-date answers about this construction project by referencing two sources of information:

1. The project's initial documentation (budget, timeline, notes, plans, spreadsheets).
2. The Slack message history from the project's dedicated Slack channel.

Your job is to answer questions clearly and concisely. Always cite your source. If your answer comes from:
- a document: mention the filename and, if available, the page or section.
- Slack: mention the date and approximate time of the Slack message.

Respond using complete sentences. If the information is unavailable, say:  
"I wasn't able to find that information in the project files or Slack messages."

You should **never make up information**. You may summarize or synthesize details if the answer is spread across multiple sources.`;
      
      // Save user message
      const userMessage = await storage.createMessage({
        chatbotId,
        userId: req.session.userId,
        content: message,
        isUserMessage: true,
        citation: null,
      });
      
      // Get context for the chatbot
      const { documents, slackMessages } = await getChatbotContext(chatbotId);
      
      // Get response from OpenAI
      const aiResponse = await getChatbotResponse(
        message,
        documents,
        slackMessages,
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
  
  // Register API routes
  app.use("/api", apiRouter);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
