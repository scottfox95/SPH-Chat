import { nanoid } from "nanoid";
import { 
  users, 
  chatbots, 
  documents, 
  summaries, 
  emailRecipients, 
  messages,
  type User, 
  type InsertUser,
  type Chatbot,
  type InsertChatbot,
  type Document,
  type InsertDocument, 
  type Summary,
  type InsertSummary,
  type EmailRecipient,
  type InsertEmailRecipient,
  type Message,
  type InsertMessage
} from "@shared/schema";

// Interface for storage methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chatbot methods
  getChatbots(): Promise<Chatbot[]>;
  getChatbot(id: number): Promise<Chatbot | undefined>;
  getChatbotByToken(token: string): Promise<Chatbot | undefined>;
  createChatbot(chatbot: Omit<InsertChatbot, "publicToken">): Promise<Chatbot>;
  updateChatbot(id: number, data: Partial<InsertChatbot>): Promise<Chatbot | undefined>;
  deleteChatbot(id: number): Promise<boolean>;
  
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
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private chatbots: Map<number, Chatbot>;
  private documents: Map<number, Document>;
  private summaries: Map<number, Summary>;
  private emailRecipients: Map<number, EmailRecipient>;
  private messages: Map<number, Message>;
  
  private currentUserId: number;
  private currentChatbotId: number;
  private currentDocumentId: number;
  private currentSummaryId: number;
  private currentEmailRecipientId: number;
  private currentMessageId: number;
  
  constructor() {
    this.users = new Map();
    this.chatbots = new Map();
    this.documents = new Map();
    this.summaries = new Map();
    this.emailRecipients = new Map();
    this.messages = new Map();
    
    this.currentUserId = 1;
    this.currentChatbotId = 1;
    this.currentDocumentId = 1;
    this.currentSummaryId = 1;
    this.currentEmailRecipientId = 1;
    this.currentMessageId = 1;
    
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
  
  // Chatbot methods
  async getChatbots(): Promise<Chatbot[]> {
    return Array.from(this.chatbots.values());
  }
  
  async getChatbot(id: number): Promise<Chatbot | undefined> {
    return this.chatbots.get(id);
  }
  
  async getChatbotByToken(token: string): Promise<Chatbot | undefined> {
    return Array.from(this.chatbots.values()).find(
      (chatbot) => chatbot.publicToken === token
    );
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
}

// Export a storage instance
export const storage = new MemStorage();
