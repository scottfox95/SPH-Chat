import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Available OpenAI models
export const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4.1-nano",
  "gpt-4.1-preview",
  "gpt-4-turbo",
  "gpt-4-vision-preview",
  "gpt-4",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-16k"
];

// Basic user model for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("user"),
  initial: text("initial").notNull(),
});

// Chatbot model for project-specific bots
export const chatbots = pgTable("chatbots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slackChannelId: text("slack_channel_id").notNull(),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  publicToken: text("public_token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  requireAuth: boolean("require_auth").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Document uploads related to chatbots
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").notNull().references(() => chatbots.id, { onDelete: 'cascade' }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(),
  uploadedById: integer("uploaded_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Weekly summary reports
export const summaries = pgTable("summaries", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").notNull().references(() => chatbots.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  week: text("week").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Emails for summary distribution
export const emailRecipients = pgTable("email_recipients", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").notNull().references(() => chatbots.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
});

// Chat message history
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").notNull().references(() => chatbots.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  isUserMessage: boolean("is_user_message").notNull(),
  citation: text("citation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Application settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  openaiModel: text("openai_model").notNull().default("gpt-4o"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema validations
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  initial: true,
  role: true,
});

export const insertChatbotSchema = createInsertSchema(chatbots).pick({
  name: true,
  slackChannelId: true,
  createdById: true,
  publicToken: true,
  isActive: true,
  requireAuth: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  chatbotId: true,
  filename: true,
  originalName: true,
  fileType: true,
  uploadedById: true,
});

export const insertSummarySchema = createInsertSchema(summaries).pick({
  chatbotId: true,
  content: true,
  week: true,
});

export const insertEmailRecipientSchema = createInsertSchema(emailRecipients).pick({
  chatbotId: true,
  email: true,
});

export const insertMessageSchema = createInsertSchema(messages)
  .pick({
    chatbotId: true,
    userId: true,
    content: true,
    isUserMessage: true,
    citation: true,
  })
  .transform((data) => ({
    ...data,
    userId: data.userId ?? null,
    citation: data.citation ?? null
  }));

export const insertSettingsSchema = createInsertSchema(settings).pick({
  openaiModel: true,
});

export const updateSettingsSchema = createInsertSchema(settings).pick({
  openaiModel: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Chatbot = typeof chatbots.$inferSelect;
export type InsertChatbot = z.infer<typeof insertChatbotSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = z.infer<typeof insertSummarySchema>;

export type EmailRecipient = typeof emailRecipients.$inferSelect;
export type InsertEmailRecipient = z.infer<typeof insertEmailRecipientSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// Custom types for API requests/responses
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required"),
  chatbotId: z.number().optional(),
  token: z.string().optional(),
});

export const addEmailRecipientSchema = z.object({
  chatbotId: z.number(),
  email: z.string().email("Invalid email format"),
});
