import { nanoid } from "nanoid";
import { 
  users, 
  chatbots, 
  chatbotAsanaProjects,
  documents, 
  summaries, 
  emailRecipients, 
  messages,
  settings,
  apiTokens,
  type User, 
  type InsertUser,
  type Chatbot,
  type InsertChatbot,
  type ChatbotAsanaProject,
  type InsertChatbotAsanaProject,
  type Document,
  type InsertDocument, 
  type Summary,
  type InsertSummary,
  type EmailRecipient,
  type InsertEmailRecipient,
  type Message,
  type InsertMessage,
  type Settings,
  type UpdateSettings,
  type ApiToken,
  type InsertApiToken,
  type UpdateApiToken
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import createMemoryStore from "memorystore";
import { generatePublicToken } from "./lib/generatePublicToken";

// Interface for storage methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Chatbot methods
  getChatbots(): Promise<Chatbot[]>;
  getChatbot(id: number): Promise<Chatbot | undefined>;
  getChatbotByToken(token: string): Promise<Chatbot | undefined>;
  createChatbot(chatbot: Omit<InsertChatbot, "publicToken">): Promise<Chatbot>;
  updateChatbot(id: number, data: Partial<InsertChatbot>): Promise<Chatbot | undefined>;
  deleteChatbot(id: number): Promise<boolean>;
  
  // Chatbot Asana project methods
  getChatbotAsanaProjects(chatbotId: number): Promise<ChatbotAsanaProject[]>;
  addChatbotAsanaProject(project: InsertChatbotAsanaProject): Promise<ChatbotAsanaProject>;
  deleteChatbotAsanaProject(id: number): Promise<boolean>;
  
  // Document methods
  getDocuments(chatbotId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Summary methods
  getSummaries(chatbotId: number): Promise<Summary[]>;
  createSummary(summary: InsertSummary): Promise<Summary>;
  
  // Email recipient methods
  getEmailRecipients(chatbotId: number): Promise<EmailRecipient[]>;
  createEmailRecipient(recipient: InsertEmailRecipient): Promise<EmailRecipient>;
  deleteEmailRecipient(id: number): Promise<boolean>;
  
  // Message methods
  getMessages(chatbotId: number, limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  clearMessages(chatbotId: number): Promise<boolean>;
  
  // Settings methods
  getSettings(): Promise<Settings | undefined>;
  updateSettings(data: UpdateSettings): Promise<Settings>;
  
  // API token methods
  getApiToken(service: string): Promise<ApiToken | undefined>;
  saveApiToken(token: InsertApiToken): Promise<ApiToken>;
  
  // Session store for authentication
  sessionStore: session.Store;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private chatbots: Map<number, Chatbot>;
  private documents: Map<number, Document>;
  private summaries: Map<number, Summary>;
  private emailRecipients: Map<number, EmailRecipient>;
  private messages: Map<number, Message>;
  private apiTokens: Map<string, ApiToken>; // API tokens by service name
  private appSettings: Settings | undefined;
  
  private currentUserId: number;
  private currentChatbotId: number;
  private currentDocumentId: number;
  private currentSummaryId: number;
  private currentEmailRecipientId: number;
  private currentMessageId: number;
  private currentApiTokenId: number;
  
  public sessionStore: session.Store;
  
  constructor() {
    this.users = new Map();
    this.chatbots = new Map();
    this.documents = new Map();
    this.summaries = new Map();
    this.emailRecipients = new Map();
    this.messages = new Map();
    this.apiTokens = new Map();
    
    this.currentUserId = 1;
    this.currentChatbotId = 1;
    this.currentDocumentId = 1;
    this.currentSummaryId = 1;
    this.currentEmailRecipientId = 1;
    this.currentMessageId = 1;
    this.currentApiTokenId = 1;
    
    // Set up memory session store
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Create default admin user
    this.createUser({
      username: "admin",
      password: "password",
      displayName: "John Davis",
      initial: "JD",
      role: "admin"
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "user" // Ensure role is not undefined
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...data,
      // Keep the original ID
      id: user.id
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // Don't allow deleting the admin user (id 1)
    if (id === 1) return false;
    
    return this.users.delete(id);
  }
  
  // Chatbot methods
  async getChatbots(): Promise<Chatbot[]> {
    const chatbots = Array.from(this.chatbots.values());
    // Map each chatbot through the compatibility method
    return chatbots.map(chatbot => this.ensureChatbotFieldBackwardCompatibility(chatbot));
  }
  
  async getChatbot(id: number): Promise<Chatbot | undefined> {
    const chatbot = this.chatbots.get(id);
    return chatbot ? this.ensureChatbotFieldBackwardCompatibility(chatbot) : undefined;
  }
  
  async getChatbotByToken(token: string): Promise<Chatbot | undefined> {
    const chatbot = Array.from(this.chatbots.values()).find(
      (chatbot) => chatbot.publicToken === token
    );
    return chatbot ? this.ensureChatbotFieldBackwardCompatibility(chatbot) : undefined;
  }
  
  // Helper method to ensure all chatbot instances have the asanaConnectionId field
  private ensureChatbotFieldBackwardCompatibility(chatbot: any): Chatbot {
    if ('asanaConnectionId' in chatbot) {
      return chatbot as Chatbot;
    }
    
    // Cast to any to avoid type issues
    const typedChatbot = chatbot as any;
    typedChatbot.asanaConnectionId = null;
    
    return typedChatbot as Chatbot;
  }
  
  async createChatbot(chatbot: Omit<InsertChatbot, "publicToken">): Promise<Chatbot> {
    const id = this.currentChatbotId++;
    // Use the same UUID generator as the database storage
    const publicToken = await generatePublicToken();
    const now = new Date();
    
    const newChatbot: Chatbot = {
      ...chatbot,
      id,
      publicToken,
      createdAt: now,
      asanaProjectId: chatbot.asanaProjectId || null,
      asanaConnectionId: null, // Initialize as null for backward compatibility
      isActive: chatbot.isActive ?? true,
      requireAuth: chatbot.requireAuth ?? false
    };
    
    this.chatbots.set(id, newChatbot);
    return newChatbot;
  }
  
  async updateChatbot(id: number, data: Partial<InsertChatbot>): Promise<Chatbot | undefined> {
    const chatbot = this.chatbots.get(id);
    if (!chatbot) return undefined;
    
    const updatedChatbot: Chatbot = {
      ...chatbot,
      ...data
    };
    
    this.chatbots.set(id, updatedChatbot);
    return updatedChatbot;
  }
  
  async deleteChatbot(id: number): Promise<boolean> {
    return this.chatbots.delete(id);
  }
  
  // Chatbot Asana project methods
  async getChatbotAsanaProjects(chatbotId: number): Promise<ChatbotAsanaProject[]> {
    // Implementation would go here in a real memory storage
    // Since we're switching to database storage, this is a placeholder
    return [];
  }
  
  async addChatbotAsanaProject(project: InsertChatbotAsanaProject): Promise<ChatbotAsanaProject> {
    // Implementation would go here in a real memory storage
    // Since we're switching to database storage, this is a placeholder
    throw new Error("Not implemented in MemStorage");
  }
  
  async deleteChatbotAsanaProject(id: number): Promise<boolean> {
    // Implementation would go here in a real memory storage
    // Since we're switching to database storage, this is a placeholder
    return false;
  }
  
  // Document methods
  async getDocuments(chatbotId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (document) => document.chatbotId === chatbotId
    );
  }
  
  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.currentDocumentId++;
    const now = new Date();
    
    const newDocument: Document = {
      ...document,
      id,
      createdAt: now
    };
    
    this.documents.set(id, newDocument);
    return newDocument;
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }
  
  // Summary methods
  async getSummaries(chatbotId: number): Promise<Summary[]> {
    return Array.from(this.summaries.values())
      .filter((summary) => summary.chatbotId === chatbotId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()); // Most recent first
  }
  
  async createSummary(summary: InsertSummary): Promise<Summary> {
    const id = this.currentSummaryId++;
    const now = new Date();
    
    const newSummary: Summary = {
      ...summary,
      id,
      sentAt: now
    };
    
    this.summaries.set(id, newSummary);
    return newSummary;
  }
  
  // Email recipient methods
  async getEmailRecipients(chatbotId: number): Promise<EmailRecipient[]> {
    return Array.from(this.emailRecipients.values()).filter(
      (recipient) => recipient.chatbotId === chatbotId
    );
  }
  
  async createEmailRecipient(recipient: InsertEmailRecipient): Promise<EmailRecipient> {
    const id = this.currentEmailRecipientId++;
    
    const newRecipient: EmailRecipient = {
      ...recipient,
      id
    };
    
    this.emailRecipients.set(id, newRecipient);
    return newRecipient;
  }
  
  async deleteEmailRecipient(id: number): Promise<boolean> {
    return this.emailRecipients.delete(id);
  }
  
  // Message methods
  async getMessages(chatbotId: number, limit = 50): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.chatbotId === chatbotId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) // Oldest first
      .slice(-limit);
  }
  
  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const now = new Date();
    
    const newMessage: Message = {
      ...message,
      id,
      createdAt: now,
      userId: message.userId ?? null,
      citation: message.citation ?? null
    };
    
    this.messages.set(id, newMessage);
    return newMessage;
  }
  
  async clearMessages(chatbotId: number): Promise<boolean> {
    // Get all messages for this chatbot
    const chatbotMessages = Array.from(this.messages.entries())
      .filter(([_, message]) => message.chatbotId === chatbotId);
    
    // Delete each message
    chatbotMessages.forEach(([id, _]) => {
      this.messages.delete(id);
    });
    
    return true;
  }
  
  // Settings methods
  async getSettings(): Promise<Settings | undefined> {
    if (!this.appSettings) {
      // Initialize with default settings
      const now = new Date();
      this.appSettings = {
        id: 1,
        openaiModel: "gpt-4o",
        includeSourceDetails: false,
        includeDateInSource: false,
        includeUserInSource: false,
        responseTemplate: null,
        createdAt: now,
        updatedAt: now
      };
    }
    return this.appSettings;
  }
  
  async updateSettings(data: UpdateSettings): Promise<Settings> {
    const now = new Date();
    
    if (!this.appSettings) {
      // Initialize with defaults and update
      this.appSettings = {
        id: 1,
        openaiModel: data.openaiModel || "gpt-4o",
        includeSourceDetails: data.includeSourceDetails ?? false,
        includeDateInSource: data.includeDateInSource ?? false,
        includeUserInSource: data.includeUserInSource ?? false,
        responseTemplate: data.responseTemplate ?? null,
        createdAt: now,
        updatedAt: now
      };
    } else {
      // Update existing settings
      this.appSettings = {
        ...this.appSettings,
        ...data,
        updatedAt: now
      };
    }
    
    return this.appSettings;
  }
  
  // API token methods
  async getApiToken(service: string): Promise<ApiToken | undefined> {
    return Array.from(this.apiTokens.values()).find(
      (token) => token.service === service
    );
  }
  
  async saveApiToken(token: InsertApiToken): Promise<ApiToken> {
    const now = new Date();
    
    // Check if token already exists for this service
    const existingToken = await this.getApiToken(token.service);
    
    if (existingToken) {
      // Update existing token
      const updatedToken: ApiToken = {
        ...existingToken,
        tokenHash: token.tokenHash,
        updatedAt: now
      };
      
      this.apiTokens.set(token.service, updatedToken);
      return updatedToken;
    } else {
      // Create new token
      const id = this.currentApiTokenId++;
      
      const newToken: ApiToken = {
        ...token,
        id,
        createdAt: now,
        updatedAt: now
      };
      
      this.apiTokens.set(token.service, newToken);
      return newToken;
    }
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    try {
      // Use a fallback session store in case the database isn't available
      const MemoryStore = createMemoryStore(session);
      const fallbackStore = new MemoryStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      });
      
      // Set the fallback store first so we have something working
      this.sessionStore = fallbackStore;
      
      // Set up PostgreSQL session store
      const PostgresSessionStore = connectPg(session);
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Log which environment we're running in
      console.log(`Initializing session store in ${isProduction ? 'production' : 'development'} environment`);
      
      // Now try to use a PostgreSQL session store with robust error handling
      try {
        // Use more robust session store settings
        this.sessionStore = new PostgresSessionStore({ 
          pool,
          createTableIfMissing: true, // Allow it to create the table if needed
          tableName: 'session',
          ttl: 86400, // Session TTL in seconds (1 day)
          disableTouch: false,
          errorLog: console.error
        });
        
        console.log("PostgreSQL session store initialized successfully");
      } catch (sessionStoreError) {
        console.error("Failed to create PostgreSQL session store, using memory store instead:", sessionStoreError);
        // Keep using the fallback store (already assigned)
      }
    } catch (error) {
      console.error("Critical error in storage constructor:", error);
      // Create a basic in-memory store as a last resort
      const MemoryStore = createMemoryStore(session);
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000
      });
    }
    
    // Try to create a default admin user, but don't let failures stop the app
    try {
      // Create default admin user if it doesn't exist (but don't wait for it)
      this.getUserByUsername("admin")
        .then(user => {
          if (!user) {
            return this.createUser({
              username: "admin",
              password: "password", 
              displayName: "Admin User",
              initial: "AU",
              role: "admin"
            });
          }
          return user;
        })
        .then(user => {
          console.log("Admin user is available:", user.username);
        })
        .catch(error => {
          console.error("Error checking/creating admin user:", error);
        });
    } catch (error) {
      console.error("Error in admin user creation logic:", error);
      // Continue anyway - this is not critical
    }
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    // Hash password if it's being updated
    if (data.password) {
      // We need to hash the password before storing it
      // This is a simplified example. In a real app, use a proper password hashing function
      try {
        const crypto = require('crypto');
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync(data.password, salt, 64).toString('hex');
        data.password = `${hash}.${salt}`;
      } catch (error) {
        console.error('Error hashing password:', error);
        // If hashing fails, don't update the password
        delete data.password;
      }
    }
    
    const [updatedUser] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // Don't allow deleting the admin user (id 1)
    if (id === 1) return false;
    
    const result = await db.delete(users).where(eq(users.id, id));
    return !!result;
  }
  
  // Chatbot methods
  async getChatbots(): Promise<Chatbot[]> {
    try {
      console.log("Fetching all chatbots from database");
      const results = await db.select().from(chatbots);
      console.log("Fetched chatbots count:", results.length);
      return results;
    } catch (error) {
      console.error("Error fetching chatbots:", error);
      return [];
    }
  }
  
  async getChatbot(id: number): Promise<Chatbot | undefined> {
    try {
      console.log(`Fetching chatbot with id: ${id}`);
      const [chatbot] = await db.select().from(chatbots).where(eq(chatbots.id, id));
      console.log(`Chatbot found:`, chatbot ? "Yes" : "No");
      return chatbot;
    } catch (error) {
      console.error(`Error fetching chatbot with id ${id}:`, error);
      return undefined;
    }
  }
  
  async getChatbotByToken(token: string): Promise<Chatbot | undefined> {
    const [chatbot] = await db.select().from(chatbots).where(eq(chatbots.publicToken, token));
    return chatbot;
  }
  
  async createChatbot(chatbot: Omit<InsertChatbot, "publicToken">): Promise<Chatbot> {
    try {
      console.log("Creating chatbot with data:", JSON.stringify({
        ...chatbot,
        password: "REDACTED"
      }, null, 2));
      
      // Generate a UUID token that is guaranteed to be unique
      const publicToken = await generatePublicToken();
      
      console.log("Using public token:", publicToken);
      
      // Set default values for fields that might be missing
      const chatbotData = {
        name: chatbot.name,
        slackChannelId: chatbot.slackChannelId,
        createdById: chatbot.createdById,
        publicToken: publicToken,
        isActive: chatbot.isActive ?? true,
        requireAuth: chatbot.requireAuth ?? false,
        asanaProjectId: chatbot.asanaProjectId || null,
        asanaConnectionId: null
      };
      
      console.log("Final chatbot data for insertion:", JSON.stringify(chatbotData, null, 2));
      
      try {
        // Using raw SQL for the most compatibility across PostgreSQL versions
        console.log("Attempting direct SQL insert of chatbot");
        
        const result = await db.execute(sql`
          INSERT INTO chatbots (
            name, 
            slack_channel_id, 
            created_by_id, 
            public_token, 
            is_active, 
            require_auth
          )
          VALUES (
            ${chatbotData.name}, 
            ${chatbotData.slackChannelId}, 
            ${chatbotData.createdById}, 
            ${chatbotData.publicToken}, 
            ${chatbotData.isActive}, 
            ${chatbotData.requireAuth}
          )
          RETURNING *
        `);
        
        if (result && result.length > 0) {
          console.log("Successfully created chatbot with direct SQL:", result[0]);
          return result[0];
        }
        
        // If we don't get a result with RETURNING, try to fetch it
        console.log("Insert succeeded but no returning data, fetching chatbot by token");
        const [createdChatbot] = await db.select()
          .from(chatbots)
          .where(eq(chatbots.publicToken, publicToken));
        
        if (!createdChatbot) {
          throw new Error("Chatbot was created but couldn't be retrieved");
        }
        
        console.log("Successfully retrieved created chatbot:", createdChatbot);
        return createdChatbot;
      } catch (insertError) {
        console.error("Error during chatbot insertion:", insertError);
        
        // Last-resort fallback - try plain insert
        try {
          console.log("Trying direct SQL insert without returning");
          await db.execute(sql`
            INSERT INTO chatbots (
              name, 
              slack_channel_id, 
              created_by_id, 
              public_token, 
              is_active, 
              require_auth
            )
            VALUES (
              ${chatbotData.name}, 
              ${chatbotData.slackChannelId}, 
              ${chatbotData.createdById}, 
              ${chatbotData.publicToken}, 
              ${chatbotData.isActive}, 
              ${chatbotData.requireAuth}
            )
          `);
          
          // Wait a moment to ensure the database has time to complete the insert
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to fetch the chatbot we just created
          const [createdChatbot] = await db.select()
            .from(chatbots)
            .where(eq(chatbots.publicToken, publicToken));
          
          if (!createdChatbot) {
            throw new Error("Chatbot was created but couldn't be retrieved");
          }
          
          console.log("Successfully created and retrieved chatbot with fallback method:", createdChatbot);
          return createdChatbot;
        } catch (fallbackError) {
          console.error("All insertion methods failed:", fallbackError);
          
          // Try to provide helpful diagnostic information
          try {
            const tableInfo = await db.execute(sql`
              SELECT column_name, data_type, is_nullable
              FROM information_schema.columns
              WHERE table_name = 'chatbots'
            `);
            console.error("Chatbots table schema:", tableInfo);
          } catch (schemaError) {
            console.error("Failed to get schema info:", schemaError);
          }
          
          throw new Error(`Failed to create chatbot: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error("Error in createChatbot:", error);
      throw error;
    }
  }
  
  async updateChatbot(id: number, data: Partial<InsertChatbot>): Promise<Chatbot | undefined> {
    const [updatedChatbot] = await db.update(chatbots)
      .set(data)
      .where(eq(chatbots.id, id))
      .returning();
    
    return updatedChatbot;
  }
  
  async deleteChatbot(id: number): Promise<boolean> {
    const result = await db.delete(chatbots).where(eq(chatbots.id, id));
    return !!result;
  }
  
  // Chatbot Asana project methods
  async getChatbotAsanaProjects(chatbotId: number): Promise<ChatbotAsanaProject[]> {
    return db.select()
      .from(chatbotAsanaProjects)
      .where(eq(chatbotAsanaProjects.chatbotId, chatbotId));
  }
  
  async addChatbotAsanaProject(project: InsertChatbotAsanaProject): Promise<ChatbotAsanaProject> {
    const [newProject] = await db.insert(chatbotAsanaProjects)
      .values(project)
      .returning();
    
    return newProject;
  }
  
  async deleteChatbotAsanaProject(id: number): Promise<boolean> {
    const result = await db.delete(chatbotAsanaProjects).where(eq(chatbotAsanaProjects.id, id));
    return !!result;
  }
  
  // Document methods
  async getDocuments(chatbotId: number): Promise<Document[]> {
    return db.select()
      .from(documents)
      .where(eq(documents.chatbotId, chatbotId));
  }
  
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents)
      .values(document)
      .returning();
    
    return newDocument;
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return !!result;
  }
  
  // Summary methods
  async getSummaries(chatbotId: number): Promise<Summary[]> {
    return db.select()
      .from(summaries)
      .where(eq(summaries.chatbotId, chatbotId))
      .orderBy(desc(summaries.sentAt)); // Most recent first
  }
  
  async createSummary(summary: InsertSummary): Promise<Summary> {
    const [newSummary] = await db.insert(summaries)
      .values(summary)
      .returning();
    
    return newSummary;
  }
  
  // Email recipient methods
  async getEmailRecipients(chatbotId: number): Promise<EmailRecipient[]> {
    return db.select()
      .from(emailRecipients)
      .where(eq(emailRecipients.chatbotId, chatbotId));
  }
  
  async createEmailRecipient(recipient: InsertEmailRecipient): Promise<EmailRecipient> {
    const [newRecipient] = await db.insert(emailRecipients)
      .values(recipient)
      .returning();
    
    return newRecipient;
  }
  
  async deleteEmailRecipient(id: number): Promise<boolean> {
    const result = await db.delete(emailRecipients).where(eq(emailRecipients.id, id));
    return !!result;
  }
  
  // Message methods
  async getMessages(chatbotId: number, limit = 50): Promise<Message[]> {
    return db.select()
      .from(messages)
      .where(eq(messages.chatbotId, chatbotId))
      .orderBy(messages.createdAt) // Oldest first
      .limit(limit);
  }
  
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages)
      .values({
        ...message,
        userId: message.userId ?? null,
        citation: message.citation ?? null
      })
      .returning();
    
    return newMessage;
  }
  
  async clearMessages(chatbotId: number): Promise<boolean> {
    // Delete all messages for this chatbot
    await db.delete(messages).where(eq(messages.chatbotId, chatbotId));
    return true;
  }
  
  // Settings methods
  async getSettings(): Promise<Settings | undefined> {
    const [setting] = await db.select().from(settings).limit(1);
    
    if (!setting) {
      // Initialize with default settings
      return this.updateSettings({ openaiModel: "gpt-4o" });
    }
    
    return setting;
  }
  
  async updateSettings(data: UpdateSettings): Promise<Settings> {
    const now = new Date();
    const [existingSetting] = await db.select().from(settings).limit(1);
    
    if (!existingSetting) {
      // Create settings if they don't exist
      const [newSettings] = await db.insert(settings)
        .values({
          openaiModel: data.openaiModel || "gpt-4o",
          includeSourceDetails: data.includeSourceDetails ?? false,
          includeDateInSource: data.includeDateInSource ?? false,
          includeUserInSource: data.includeUserInSource ?? false,
          responseTemplate: data.responseTemplate ?? null,
          updatedAt: now
        })
        .returning();
        
      return newSettings;
    } else {
      // Update existing settings
      const [updatedSettings] = await db.update(settings)
        .set({ 
          ...data, 
          updatedAt: now 
        })
        .where(eq(settings.id, existingSetting.id))
        .returning();
        
      return updatedSettings;
    }
  }
  
  // API token methods
  async getApiToken(service: string): Promise<ApiToken | undefined> {
    const [token] = await db.select()
      .from(apiTokens)
      .where(eq(apiTokens.service, service));
      
    return token;
  }
  
  async saveApiToken(token: InsertApiToken): Promise<ApiToken> {
    const now = new Date();
    const existingToken = await this.getApiToken(token.service);
    
    if (existingToken) {
      // Update existing token
      const [updatedToken] = await db.update(apiTokens)
        .set({ 
          tokenHash: token.tokenHash,
          updatedAt: now 
        })
        .where(eq(apiTokens.id, existingToken.id))
        .returning();
        
      return updatedToken;
    } else {
      // Create new token
      const [newToken] = await db.insert(apiTokens)
        .values({
          ...token,
          updatedAt: now
        })
        .returning();
        
      return newToken;
    }
  }
}

// Export a storage instance
export const storage = new DatabaseStorage();
