// Only keep necessary imports
import crypto from "crypto";

/**
 * DATABASE APPROACH: UNIFIED DATABASE
 * 
 * This application uses a unified database approach where both development 
 * and production environments connect to the same database.
 * 
 * The connection is always made via DATABASE_URL environment variable,
 * which provides consistent behavior across environments.
 * 
 * This approach eliminates environment-specific database issues like
 * schema differences or missing records when switching environments.
 */

import { 
  users, 
  projects,
  chatbots, 
  chatbotAsanaProjects,
  documents, 
  summaries, 
  emailRecipients, 
  messages,
  settings,
  apiTokens,
  userProjects,
  projectSummaries,
  projectEmailRecipients,
  type User, 
  type InsertUser,
  type Project,
  type InsertProject,
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
  type UpdateApiToken,
  type UserProject,
  type InsertUserProject,
  type ProjectSummary,
  type InsertProjectSummary,
  type ProjectEmailRecipient,
  type InsertProjectEmailRecipient
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
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Project methods
  getProjects(): Promise<Project[]>;
  getAllProjects(): Promise<Project[]>; // Get all projects for scheduler
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  getProjectChatbots(projectId: number): Promise<Chatbot[]>;
  getProjectSummarySettings(projectId: number): Promise<{ slackChannelId: string | null } | undefined>;
  
  // User-Project assignment methods
  getUserProjects(userId: number): Promise<UserProject[]>;
  getProjectUsers(projectId: number): Promise<User[]>;
  assignUserToProject(userId: number, projectId: number): Promise<UserProject>;
  removeUserFromProject(userId: number, projectId: number): Promise<boolean>;
  getUserAccessibleProjects(userId: number): Promise<Project[]>;
  getUserAccessibleChatbots(userId: number): Promise<Chatbot[]>;
  
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
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, data: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Summary methods
  getSummaries(chatbotId: number): Promise<Summary[]>;
  createSummary(summary: InsertSummary): Promise<Summary>;
  
  // Project Summary methods
  getProjectSummaries(projectId: number): Promise<ProjectSummary[]>;
  createProjectSummary(summary: InsertProjectSummary): Promise<ProjectSummary>;
  
  // Email recipient methods
  getEmailRecipients(chatbotId: number): Promise<EmailRecipient[]>;
  createEmailRecipient(recipient: InsertEmailRecipient): Promise<EmailRecipient>;
  deleteEmailRecipient(id: number): Promise<boolean>;
  
  // Project Email recipient methods
  getProjectEmailRecipients(projectId: number): Promise<ProjectEmailRecipient[]>;
  createProjectEmailRecipient(recipient: InsertProjectEmailRecipient): Promise<ProjectEmailRecipient>;
  deleteProjectEmailRecipient(id: number): Promise<boolean>;
  
  // Message methods
  getMessages(chatbotId: number, limit?: number): Promise<Message[]>;
  getChatbotMessagesByDateRange(chatbotId: number, startDate: Date, endDate: Date): Promise<Message[]>;
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
  
  // Database status methods
  getPoolStats?: () => { total: number, idle: number } | undefined;
  testConnection?: () => Promise<{ connected: boolean, error?: string }>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private chatbots: Map<number, Chatbot>;
  private documents: Map<number, Document>;
  private summaries: Map<number, Summary>;
  private projectSummaries: Map<number, ProjectSummary>;
  private emailRecipients: Map<number, EmailRecipient>;
  private projectEmailRecipients: Map<number, ProjectEmailRecipient>;
  private messages: Map<number, Message>;
  private apiTokens: Map<string, ApiToken>; // API tokens by service name
  private userProjects: Map<number, UserProject>; // User-Project assignments
  private appSettings: Settings | undefined;
  
  private currentUserId: number;
  private currentProjectId: number;
  private currentChatbotId: number;
  private currentDocumentId: number;
  private currentSummaryId: number;
  private currentProjectSummaryId: number;
  private currentEmailRecipientId: number;
  private currentProjectEmailRecipientId: number;
  private currentMessageId: number;
  private currentApiTokenId: number;
  private currentUserProjectId: number;
  
  public sessionStore: session.Store;
  
  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.chatbots = new Map();
    this.documents = new Map();
    this.summaries = new Map();
    this.projectSummaries = new Map();
    this.emailRecipients = new Map();
    this.projectEmailRecipients = new Map();
    this.messages = new Map();
    this.apiTokens = new Map();
    this.userProjects = new Map();
    
    this.currentUserId = 1;
    this.currentProjectId = 1;
    this.currentChatbotId = 1;
    this.currentDocumentId = 1;
    this.currentSummaryId = 1;
    this.currentProjectSummaryId = 1;
    this.currentEmailRecipientId = 1;
    this.currentProjectEmailRecipientId = 1;
    this.currentMessageId = 1;
    this.currentApiTokenId = 1;
    this.currentUserProjectId = 1;
    
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
  
  // Project methods
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }
  
  // Alias for getAllProjects for scheduler
  async getAllProjects(): Promise<Project[]> {
    return this.getProjects();
  }
  
  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }
  
  async getProjectSummarySettings(projectId: number): Promise<{ slackChannelId: string | null } | undefined> {
    try {
      // Get the last project summary to use its settings
      const projectSummariesList = Array.from(this.projectSummaries.values())
        .filter(summary => summary.projectId === projectId)
        .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()); // Latest first
        
      if (projectSummariesList.length > 0) {
        const lastSummary = projectSummariesList[0];
        return { slackChannelId: lastSummary.slackChannelId || null };
      }
      
      return undefined;
    } catch (error) {
      console.error(`Failed to get project summary settings for project with id ${projectId}:`, error);
      return undefined;
    }
  }
  
  async createProject(project: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const now = new Date();
    
    const newProject: Project = {
      ...project,
      id,
      createdAt: now,
      description: project.description || null
    };
    
    this.projects.set(id, newProject);
    return newProject;
  }
  
  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject: Project = {
      ...project,
      ...data,
      id: project.id
    };
    
    this.projects.set(id, updatedProject);
    return updatedProject;
  }
  
  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }
  
  async getProjectChatbots(projectId: number): Promise<Chatbot[]> {
    return Array.from(this.chatbots.values())
      .filter(chatbot => chatbot.projectId === projectId)
      .map(chatbot => this.ensureChatbotFieldBackwardCompatibility(chatbot));
  }
  
  // User-Project assignment methods
  async getUserProjects(userId: number): Promise<UserProject[]> {
    return Array.from(this.userProjects.values())
      .filter(userProject => userProject.userId === userId);
  }
  
  async getProjectUsers(projectId: number): Promise<User[]> {
    const userProjectAssignments = Array.from(this.userProjects.values())
      .filter(userProject => userProject.projectId === projectId);
    
    const userIds = userProjectAssignments.map(assignment => assignment.userId);
    const users = Array.from(this.users.values())
      .filter(user => userIds.includes(user.id));
    
    return users;
  }
  
  async assignUserToProject(userId: number, projectId: number): Promise<UserProject> {
    // Check if user exists
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Check if project exists
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    
    // Check if assignment already exists
    const existingAssignment = Array.from(this.userProjects.values()).find(
      up => up.userId === userId && up.projectId === projectId
    );
    
    if (existingAssignment) {
      return existingAssignment;
    }
    
    // Create new assignment
    const id = this.currentUserProjectId++;
    const now = new Date();
    
    const userProject: UserProject = {
      id,
      userId,
      projectId,
      createdAt: now
    };
    
    this.userProjects.set(id, userProject);
    return userProject;
  }
  
  async removeUserFromProject(userId: number, projectId: number): Promise<boolean> {
    const assignment = Array.from(this.userProjects.entries()).find(
      ([_, up]) => up.userId === userId && up.projectId === projectId
    );
    
    if (!assignment) {
      return false;
    }
    
    const [id, _] = assignment;
    return this.userProjects.delete(id);
  }
  
  async getUserAccessibleProjects(userId: number): Promise<Project[]> {
    // Admin users can access all projects
    const user = await this.getUser(userId);
    if (user?.role === "admin") {
      return this.getProjects();
    }
    
    // Regular users can only access projects they're assigned to
    const userProjects = await this.getUserProjects(userId);
    const projectIds = userProjects.map(up => up.projectId);
    
    return Array.from(this.projects.values())
      .filter(project => projectIds.includes(project.id));
  }
  
  async getUserAccessibleChatbots(userId: number): Promise<Chatbot[]> {
    // Admin users can access all chatbots
    const user = await this.getUser(userId);
    if (user?.role === "admin") {
      return this.getChatbots();
    }
    
    // Regular users can only access chatbots from projects they're assigned to
    const userProjects = await this.getUserProjects(userId);
    const projectIds = userProjects.map(up => up.projectId);
    
    return Array.from(this.chatbots.values())
      .filter(chatbot => chatbot.projectId !== null && projectIds.includes(chatbot.projectId))
      .map(chatbot => this.ensureChatbotFieldBackwardCompatibility(chatbot));
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
    // Generate a random UUID for consistency with the PostgreSQL implementation
    const publicToken = crypto.randomUUID();
    const now = new Date();
    
    const newChatbot: Chatbot = {
      ...chatbot,
      id,
      publicToken,
      createdAt: now,
      asanaProjectId: chatbot.asanaProjectId || null,
      asanaConnectionId: null, // Initialize as null for backward compatibility
      projectId: chatbot.projectId || null, // Initialize as null if not provided
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
  
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.currentDocumentId++;
    const now = new Date();
    
    const newDocument: Document = {
      ...document,
      id,
      createdAt: now,
      openaiFileId: null,
      vectorStoreId: null
    };
    
    this.documents.set(id, newDocument);
    return newDocument;
  }
  
  async updateDocument(id: number, data: Partial<Document>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument: Document = {
      ...document,
      ...data
    };
    
    this.documents.set(id, updatedDocument);
    return updatedDocument;
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
  
  // Project Summary methods
  async getProjectSummaries(projectId: number): Promise<ProjectSummary[]> {
    return Array.from(this.projectSummaries.values())
      .filter((summary) => summary.projectId === projectId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()); // Most recent first
  }
  
  async createProjectSummary(summary: InsertProjectSummary): Promise<ProjectSummary> {
    const id = this.currentProjectSummaryId++;
    const now = new Date();
    
    const newProjectSummary: ProjectSummary = {
      ...summary,
      id,
      sentAt: now
    };
    
    this.projectSummaries.set(id, newProjectSummary);
    return newProjectSummary;
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
  
  // Project Email recipient methods
  async getProjectEmailRecipients(projectId: number): Promise<ProjectEmailRecipient[]> {
    return Array.from(this.projectEmailRecipients.values()).filter(
      (recipient) => recipient.projectId === projectId
    );
  }
  
  async createProjectEmailRecipient(recipient: InsertProjectEmailRecipient): Promise<ProjectEmailRecipient> {
    const id = this.currentProjectEmailRecipientId++;
    
    const newRecipient: ProjectEmailRecipient = {
      ...recipient,
      id
    };
    
    this.projectEmailRecipients.set(id, newRecipient);
    return newRecipient;
  }
  
  async deleteProjectEmailRecipient(id: number): Promise<boolean> {
    return this.projectEmailRecipients.delete(id);
  }
  
  // Message methods
  async getMessages(chatbotId: number, limit = 50): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.chatbotId === chatbotId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) // Oldest first
      .slice(-limit);
  }
  
  async getChatbotMessagesByDateRange(chatbotId: number, startDate: Date, endDate: Date): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.chatbotId === chatbotId)
      .filter((message) => {
        // Check if message is within the date range
        return message.createdAt >= startDate && message.createdAt <= endDate;
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); // Oldest first
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
        summaryPrompt: null,
        // Scheduler settings
        enableDailySchedule: false,
        dailyScheduleTime: "08:00",
        enableWeeklySchedule: false,
        weeklyScheduleDay: "Monday",
        weeklyScheduleTime: "08:00",
        // SMTP settings
        smtpEnabled: false,
        smtpHost: null,
        smtpPort: "587",
        smtpUser: null,
        smtpPass: null,
        smtpFrom: null,
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
        summaryPrompt: data.summaryPrompt ?? null,
        // Scheduler settings
        enableDailySchedule: data.enableDailySchedule ?? false,
        dailyScheduleTime: data.dailyScheduleTime ?? "08:00",
        enableWeeklySchedule: data.enableWeeklySchedule ?? false,
        weeklyScheduleDay: data.weeklyScheduleDay ?? "Monday",
        weeklyScheduleTime: data.weeklyScheduleTime ?? "08:00",
        // SMTP settings
        smtpEnabled: data.smtpEnabled ?? false,
        smtpHost: data.smtpHost ?? null,
        smtpPort: data.smtpPort ?? "587",
        smtpUser: data.smtpUser ?? null,
        smtpPass: data.smtpPass ?? null,
        smtpFrom: data.smtpFrom ?? null,
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

  // Helper method to get pool statistics
  getPoolStats(): { total: number, idle: number } | undefined {
    try {
      if (pool && typeof pool.totalCount === 'number' && typeof pool.idleCount === 'number') {
        return {
          total: pool.totalCount,
          idle: pool.idleCount
        };
      }
      return undefined;
    } catch (error) {
      console.error("Error getting pool stats:", error);
      return undefined;
    }
  }
  
  // Test the database connection
  async testConnection(): Promise<{ connected: boolean, error?: string }> {
    try {
      const result = await pool.query('SELECT 1 as connection_test');
      return { connected: true };
    } catch (error) {
      console.error("Database connection test failed:", error);
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

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
  
  // Project methods
  async getProjects(): Promise<Project[]> {
    try {
      return await db.select().from(projects);
    } catch (error) {
      console.error("Failed to get projects:", error);
      return [];
    }
  }
  
  // Alias for getAllProjects for scheduler
  async getAllProjects(): Promise<Project[]> {
    return this.getProjects();
  }
  
  async getProject(id: number): Promise<Project | undefined> {
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      return project;
    } catch (error) {
      console.error(`Failed to get project with id ${id}:`, error);
      return undefined;
    }
  }
  
  async getProjectSummarySettings(projectId: number): Promise<{ slackChannelId: string | null } | undefined> {
    try {
      // Get the last project summary to use its settings
      const [lastSummary] = await db.select()
        .from(projectSummaries)
        .where(eq(projectSummaries.projectId, projectId))
        .orderBy(desc(projectSummaries.sentAt))
        .limit(1);
        
      if (lastSummary) {
        return { slackChannelId: lastSummary.slackChannelId || null };
      }
      
      return undefined;
    } catch (error) {
      console.error(`Failed to get project summary settings for project with id ${projectId}:`, error);
      return undefined;
    }
  }
  
  async createProject(project: InsertProject): Promise<Project> {
    try {
      const [newProject] = await db.insert(projects).values({
        ...project,
        description: project.description || null
      }).returning();
      return newProject;
    } catch (error) {
      console.error("Failed to create project:", error);
      throw error;
    }
  }
  
  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    try {
      const [updatedProject] = await db.update(projects)
        .set(data)
        .where(eq(projects.id, id))
        .returning();
      return updatedProject;
    } catch (error) {
      console.error(`Failed to update project with id ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteProject(id: number): Promise<boolean> {
    try {
      const result = await db.delete(projects).where(eq(projects.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error(`Failed to delete project with id ${id}:`, error);
      return false;
    }
  }
  
  async getProjectChatbots(projectId: number): Promise<Chatbot[]> {
    try {
      return await db.select().from(chatbots).where(eq(chatbots.projectId, projectId));
    } catch (error) {
      console.error(`Failed to get chatbots for project with id ${projectId}:`, error);
      return [];
    }
  }
  
  // User-Project assignment methods
  async getUserProjects(userId: number): Promise<UserProject[]> {
    try {
      return await db.select().from(userProjects).where(eq(userProjects.userId, userId));
    } catch (error) {
      console.error(`Failed to get user projects for user with id ${userId}:`, error);
      return [];
    }
  }
  
  async getProjectUsers(projectId: number): Promise<User[]> {
    try {
      // Get all user-project assignments for this project
      const assignments = await db.select().from(userProjects).where(eq(userProjects.projectId, projectId));
      
      if (assignments.length === 0) {
        return [];
      }
      
      // Get all users that are assigned to this project
      const userIds = assignments.map(assignment => assignment.userId);
      return await db.select().from(users).where(sql`${users.id} IN (${userIds.join(',')})`);
    } catch (error) {
      console.error(`Failed to get users for project with id ${projectId}:`, error);
      return [];
    }
  }
  
  async assignUserToProject(userId: number, projectId: number): Promise<UserProject> {
    try {
      // Check if user exists
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      // Check if project exists
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      // Check if assignment already exists
      const existingAssignments = await db.select().from(userProjects).where(
        and(
          eq(userProjects.userId, userId),
          eq(userProjects.projectId, projectId)
        )
      );
      
      if (existingAssignments.length > 0) {
        return existingAssignments[0];
      }
      
      // Create new assignment
      const [assignment] = await db.insert(userProjects).values({
        userId,
        projectId
      }).returning();
      
      return assignment;
    } catch (error) {
      console.error(`Failed to assign user ${userId} to project ${projectId}:`, error);
      throw error;
    }
  }
  
  async removeUserFromProject(userId: number, projectId: number): Promise<boolean> {
    try {
      const result = await db.delete(userProjects).where(
        and(
          eq(userProjects.userId, userId),
          eq(userProjects.projectId, projectId)
        )
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to remove user ${userId} from project ${projectId}:`, error);
      return false;
    }
  }
  
  async getUserAccessibleProjects(userId: number): Promise<Project[]> {
    try {
      // Admin users can access all projects
      const user = await this.getUser(userId);
      if (user?.role === "admin") {
        return this.getProjects();
      }
      
      // Regular users can only access projects they're assigned to
      const assignments = await db.select().from(userProjects).where(eq(userProjects.userId, userId));
      
      if (assignments.length === 0) {
        return [];
      }
      
      const projectIds = assignments.map(assignment => assignment.projectId);
      return await db.select().from(projects).where(sql`${projects.id} IN (${projectIds.join(',')})`);
    } catch (error) {
      console.error(`Failed to get accessible projects for user with id ${userId}:`, error);
      return [];
    }
  }
  
  async getUserAccessibleChatbots(userId: number): Promise<Chatbot[]> {
    try {
      // Admin users can access all chatbots
      const user = await this.getUser(userId);
      if (user?.role === "admin") {
        return this.getChatbots();
      }
      
      // Regular users can only access chatbots from projects they're assigned to
      const assignments = await db.select().from(userProjects).where(eq(userProjects.userId, userId));
      
      if (assignments.length === 0) {
        return [];
      }
      
      const projectIds = assignments.map(assignment => assignment.projectId);
      return await db.select().from(chatbots).where(sql`${chatbots.projectId} IN (${projectIds.join(',')}) AND ${chatbots.projectId} IS NOT NULL`);
    } catch (error) {
      console.error(`Failed to get accessible chatbots for user with id ${userId}:`, error);
      return [];
    }
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
      
      // Set default values for fields that might be missing
      const chatbotData = {
        name: chatbot.name,
        slackChannelId: chatbot.slackChannelId,
        createdById: chatbot.createdById,
        isActive: chatbot.isActive ?? true,
        requireAuth: chatbot.requireAuth ?? false,
        asanaProjectId: chatbot.asanaProjectId || null,
        asanaConnectionId: null,
        projectId: chatbot.projectId || null
      };
      
      console.log("Final chatbot data for insertion:", JSON.stringify(chatbotData, null, 2));
      
      try {
        // Generate UUID explicitly for public_token
        const publicToken = crypto.randomUUID();
        console.log("Generated explicit UUID for public_token:", publicToken);
        
        // Using raw SQL for the most compatibility across PostgreSQL versions
        console.log("Attempting direct SQL insert of chatbot with explicit public_token");
        
        const result = await db.execute(sql`
          INSERT INTO chatbots (
            name, 
            slack_channel_id, 
            created_by_id, 
            is_active, 
            require_auth,
            public_token,
            project_id
          )
          VALUES (
            ${chatbotData.name}, 
            ${chatbotData.slackChannelId}, 
            ${chatbotData.createdById}, 
            ${chatbotData.isActive}, 
            ${chatbotData.requireAuth},
            ${publicToken}::uuid,
            ${chatbotData.projectId}
          )
          RETURNING *
        `);
        
        if (result && result.rows && result.rows.length > 0) {
          // Convert the raw result to a properly typed Chatbot object
          const rawChatbot = result.rows[0];
          const chatbot: Chatbot = {
            id: Number(rawChatbot.id),
            name: String(rawChatbot.name),
            slackChannelId: String(rawChatbot.slack_channel_id),
            asanaProjectId: rawChatbot.asana_project_id ? String(rawChatbot.asana_project_id) : null,
            asanaConnectionId: rawChatbot.asana_connection_id ? String(rawChatbot.asana_connection_id) : null,
            createdById: Number(rawChatbot.created_by_id),
            publicToken: String(rawChatbot.public_token),
            isActive: Boolean(rawChatbot.is_active),
            requireAuth: Boolean(rawChatbot.require_auth),
            createdAt: typeof rawChatbot.created_at === 'string' || typeof rawChatbot.created_at === 'number' ? 
              new Date(rawChatbot.created_at) : new Date(),
            projectId: rawChatbot.project_id !== null ? Number(rawChatbot.project_id) : null
          };
          console.log("Successfully created chatbot with direct SQL:", chatbot);
          return chatbot;
        }
        
        // If we don't get a result with RETURNING, try to find the most recently created one by this user
        console.log("Insert succeeded but no returning data, fetching latest chatbot");
        const [createdChatbot] = await db.select()
          .from(chatbots)
          .where(eq(chatbots.createdById, chatbotData.createdById))
          .orderBy(desc(chatbots.createdAt))
          .limit(1);
        
        if (!createdChatbot) {
          throw new Error("Chatbot was created but couldn't be retrieved");
        }
        
        console.log("Successfully retrieved created chatbot:", createdChatbot);
        return createdChatbot;
      } catch (insertError) {
        console.error("Error during chatbot insertion:", insertError);
        
        // Last-resort fallback - try plain insert
        try {
          // Generate a new UUID for fallback method
          const publicToken = crypto.randomUUID();
          console.log("Generated explicit UUID for public_token in fallback method:", publicToken);
          
          console.log("Trying direct SQL insert with explicit public_token without returning");
          await db.execute(sql`
            INSERT INTO chatbots (
              name, 
              slack_channel_id, 
              created_by_id, 
              is_active, 
              require_auth,
              public_token,
              project_id
            )
            VALUES (
              ${chatbotData.name}, 
              ${chatbotData.slackChannelId}, 
              ${chatbotData.createdById}, 
              ${chatbotData.isActive}, 
              ${chatbotData.requireAuth},
              ${publicToken}::uuid,
              ${chatbotData.projectId}
            )
          `);
          
          // Wait a moment to ensure the database has time to complete the insert
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to fetch the most recently created chatbot by this user
          const [createdChatbot] = await db.select()
            .from(chatbots)
            .where(eq(chatbots.createdById, chatbotData.createdById))
            .orderBy(desc(chatbots.createdAt))
            .limit(1);
          
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
  
  async getDocument(id: number): Promise<Document | undefined> {
    const result = await db.select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    
    return result[0];
  }
  
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents)
      .values(document)
      .returning();
    
    return newDocument;
  }
  
  async updateDocument(id: number, data: Partial<Document>): Promise<Document | undefined> {
    const [updatedDocument] = await db.update(documents)
      .set(data)
      .where(eq(documents.id, id))
      .returning();
    
    return updatedDocument;
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
  
  // Project Summary methods
  async getProjectSummaries(projectId: number): Promise<ProjectSummary[]> {
    try {
      return db.select()
        .from(projectSummaries)
        .where(eq(projectSummaries.projectId, projectId))
        .orderBy(desc(projectSummaries.sentAt)); // Most recent first
    } catch (error) {
      console.error(`Failed to get project summaries for project with id ${projectId}:`, error);
      return [];
    }
  }
  
  async createProjectSummary(summary: InsertProjectSummary): Promise<ProjectSummary> {
    try {
      const [newSummary] = await db.insert(projectSummaries)
        .values(summary)
        .returning();
      
      return newSummary;
    } catch (error) {
      console.error("Failed to create project summary:", error);
      throw error;
    }
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
  
  // Project Email recipient methods
  async getProjectEmailRecipients(projectId: number): Promise<ProjectEmailRecipient[]> {
    try {
      return db.select()
        .from(projectEmailRecipients)
        .where(eq(projectEmailRecipients.projectId, projectId));
    } catch (error) {
      console.error(`Failed to get project email recipients for project with id ${projectId}:`, error);
      return [];
    }
  }
  
  async createProjectEmailRecipient(recipient: InsertProjectEmailRecipient): Promise<ProjectEmailRecipient> {
    try {
      const [newRecipient] = await db.insert(projectEmailRecipients)
        .values(recipient)
        .returning();
      
      return newRecipient;
    } catch (error) {
      console.error("Failed to create project email recipient:", error);
      throw error;
    }
  }
  
  async deleteProjectEmailRecipient(id: number): Promise<boolean> {
    try {
      const result = await db.delete(projectEmailRecipients).where(eq(projectEmailRecipients.id, id));
      return !!result;
    } catch (error) {
      console.error(`Failed to delete project email recipient with id ${id}:`, error);
      return false;
    }
  }
  
  // Message methods
  async getMessages(chatbotId: number, limit = 50): Promise<Message[]> {
    return db.select()
      .from(messages)
      .where(eq(messages.chatbotId, chatbotId))
      .orderBy(messages.createdAt) // Oldest first
      .limit(limit);
  }
  
  async getChatbotMessagesByDateRange(chatbotId: number, startDate: Date, endDate: Date): Promise<Message[]> {
    try {
      // Query messages within the date range for this chatbot
      const result = await db.select()
        .from(messages)
        .where(
          and(
            eq(messages.chatbotId, chatbotId),
            sql`${messages.createdAt} >= ${startDate.toISOString()}`,
            sql`${messages.createdAt} <= ${endDate.toISOString()}`
          )
        )
        .orderBy(messages.createdAt); // Sort by creation date (oldest first)
      
      return result;
    } catch (error) {
      console.error(`Failed to get messages by date range for chatbot ${chatbotId}:`, error);
      return [];
    }
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
          summaryPrompt: data.summaryPrompt ?? null,
          // Add SMTP settings fields
          smtpEnabled: data.smtpEnabled ?? false,
          smtpHost: data.smtpHost ?? null,
          smtpPort: data.smtpPort ?? "587",
          smtpUser: data.smtpUser ?? null,
          smtpPass: data.smtpPass ?? null,
          smtpFrom: data.smtpFrom ?? null,
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
