import { nanoid } from "nanoid";
import { 
  users,
  replitUsers,
  chatbots, 
  chatbotAsanaProjects,
  documents, 
  summaries, 
  emailRecipients, 
  messages,
  settings,
  apiTokens,
  type User, 
  type UpsertUser,
  type ReplitUser,
  type UpsertReplitUser,
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

// Interface for storage methods
export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: Omit<UpsertUser, "id">): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Replit Auth user methods
  getReplitUser(id: string): Promise<ReplitUser | undefined>;
  getReplitUserByUsername(username: string): Promise<ReplitUser | undefined>;
  upsertReplitUser(user: UpsertReplitUser): Promise<ReplitUser>;
  
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
  private replitUsers: Map<string, ReplitUser>;
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
    this.replitUsers = new Map();
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
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(Number(id));
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  
  async createUser(userData: Omit<UpsertUser, "id">): Promise<User> {
    const id = String(this.currentUserId++);
    const user: User = { 
      ...userData, 
      id,
      role: userData.role || "user", // Ensure role is not undefined
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      bio: userData.bio || null,
      profileImageUrl: userData.profileImageUrl || null,
      initial: userData.initial || "U",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(Number(id), user);
    return user;
  }
  
  async upsertUser(userData: UpsertUser): Promise<User> {
    // Convert string ID to number for in-memory storage
    const numericId = Number(userData.id);
    const existingUser = this.users.get(numericId);
    
    if (existingUser) {
      // Update existing user
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: new Date()
      };
      this.users.set(numericId, updatedUser);
      return updatedUser;
    }
    
    // Create new user
    const user: User = {
      ...userData,
      role: userData.role || "user",
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      bio: userData.bio || null,
      profileImageUrl: userData.profileImageUrl || null,
      initial: userData.initial || "U",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(numericId, user);
    return user;
  }
  
  // Replit Auth user methods
  async getReplitUser(id: string): Promise<ReplitUser | undefined> {
    return this.replitUsers.get(id);
  }
  
  async getReplitUserByUsername(username: string): Promise<ReplitUser | undefined> {
    return Array.from(this.replitUsers.values()).find(
      (user) => user.username === username
    );
  }
  
  async upsertReplitUser(userData: UpsertReplitUser): Promise<ReplitUser> {
    const existingUser = this.replitUsers.get(userData.id);
    
    if (existingUser) {
      // Update existing user
      const updatedUser: ReplitUser = {
        ...existingUser,
        ...userData,
        updatedAt: new Date()
      };
      this.replitUsers.set(userData.id, updatedUser);
      return updatedUser;
    }
    
    // Create new user
    const user: ReplitUser = {
      ...userData,
      role: userData.role || "user",
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      bio: userData.bio || null,
      profileImageUrl: userData.profileImageUrl || null,
      initial: userData.initial || "U",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.replitUsers.set(userData.id, user);
    return user;
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
    const publicToken = nanoid(10);
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
    // Set up PostgreSQL session store
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
    
    // Create default admin user if it doesn't exist
    this.getUserByUsername("admin").then(user => {
      if (!user) {
        this.createUser({
          username: "admin",
          email: "admin@example.com",
          firstName: "John",
          lastName: "Davis",
          initial: "JD",
          role: "admin"
        });
      }
    });
  }
  
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(userData: Omit<UpsertUser, "id">): Promise<User> {
    const [user] = await db.insert(users).values(userData as any).returning();
    return user;
  }
  
  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
  
  // Chatbot methods
  async getChatbots(): Promise<Chatbot[]> {
    return db.select().from(chatbots);
  }
  
  async getChatbot(id: number): Promise<Chatbot | undefined> {
    const [chatbot] = await db.select().from(chatbots).where(eq(chatbots.id, id));
    return chatbot;
  }
  
  async getChatbotByToken(token: string): Promise<Chatbot | undefined> {
    const [chatbot] = await db.select().from(chatbots).where(eq(chatbots.publicToken, token));
    return chatbot;
  }
  
  async createChatbot(chatbot: Omit<InsertChatbot, "publicToken">): Promise<Chatbot> {
    const publicToken = nanoid(10);
    
    const [newChatbot] = await db.insert(chatbots).values({
      ...chatbot,
      publicToken,
      isActive: chatbot.isActive ?? true,
      requireAuth: chatbot.requireAuth ?? false
    }).returning();
    
    return newChatbot;
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
