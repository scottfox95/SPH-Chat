import { pgTable, text, serial, integer, boolean, timestamp, json, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Available OpenAI models
export const OPENAI_MODELS = [
  "gpt-4.1-mini", // New model released May 2025
  "o4-mini", // New o4-mini model (note: OpenAI uses o4-mini, not gpt-4o-mini)
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-16k"
];

// Summary Types
export const SUMMARY_TYPES = {
  CHATBOT: "chatbot",
  PROJECT: "project"
};

// Basic user model for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("user"),
  initial: text("initial").notNull(),
});

// Projects to group chatbots
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chatbot model for project-specific bots
export const chatbots = pgTable("chatbots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slackChannelId: text("slack_channel_id").notNull(),
  asanaProjectId: text("asana_project_id"), // Keep for backward compatibility
  asanaConnectionId: text("asana_connection_id"), // Keep for backward compatibility
  createdById: integer("created_by_id").notNull().references(() => users.id),
  projectId: integer("project_id").references(() => projects.id),
  publicToken: uuid("public_token").notNull().unique().defaultRandom(),
  isActive: boolean("is_active").notNull().default(true),
  requireAuth: boolean("require_auth").notNull().default(false),
  systemPrompt: text("system_prompt"), // Custom system prompt for this chatbot (null = use app-wide prompt)
  outputFormat: text("output_format"), // Output format template (null = no specific format required)
  vectorStoreId: text("vector_store_id"), // OpenAI vector store ID for this chatbot
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relation table for chatbot to Asana project associations
export const chatbotAsanaProjects = pgTable("chatbot_asana_projects", {
  id: serial("id").primaryKey(),
  chatbotId: integer("chatbot_id").notNull().references(() => chatbots.id, { onDelete: 'cascade' }),
  asanaProjectId: text("asana_project_id").notNull(),
  projectName: text("project_name").notNull(), // Store project name for display purposes
  projectType: text("project_type").notNull().default("main"), // "main", "permit", "design", etc.
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
  openaiFileId: text("openai_file_id"), // OpenAI file ID for vector storage
  vectorStoreId: text("vector_store_id"), // OpenAI vector store ID
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
  includeSourceDetails: boolean("include_source_details").notNull().default(false),
  includeDateInSource: boolean("include_date_in_source").notNull().default(false),
  includeUserInSource: boolean("include_user_in_source").notNull().default(false),
  responseTemplate: text("response_template"),
  summaryPrompt: text("summary_prompt"),
  // Scheduling settings
  enableDailySchedule: boolean("enable_daily_schedule").default(false),
  dailyScheduleTime: text("daily_schedule_time").default("08:00"), // Format: HH:MM in 24-hour format
  enableWeeklySchedule: boolean("enable_weekly_schedule").default(false),
  weeklyScheduleDay: text("weekly_schedule_day").default("Monday"), // Day of week for weekly summary
  weeklyScheduleTime: text("weekly_schedule_time").default("08:00"), // Format: HH:MM in 24-hour format
  // Email settings
  smtpEnabled: boolean("smtp_enabled").default(false),
  smtpHost: text("smtp_host"),
  smtpPort: text("smtp_port").default("587"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  smtpFrom: text("smtp_from"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// API tokens (for secure storage in DB)
export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  service: text("service").notNull().unique(), // 'slack', 'openai', 'asana'
  tokenHash: text("token_hash").notNull(), // Hashed token for security
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User-Project assignments to control access
export const userProjects = pgTable("user_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Project-level weekly summary reports
export const projectSummaries = pgTable("project_summaries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  week: text("week").notNull(),
  slackChannelId: text("slack_channel_id"), // Optional Slack channel ID for sending project summaries
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Project-level email recipients for summaries
export const projectEmailRecipients = pgTable("project_email_recipients", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
});

// Schema validations
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  initial: true,
  role: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  description: true,
  createdById: true,
});

export const insertChatbotSchema = createInsertSchema(chatbots).pick({
  name: true,
  slackChannelId: true,
  asanaProjectId: true,
  createdById: true,
  projectId: true,
  isActive: true,
  requireAuth: true,
  systemPrompt: true,
  outputFormat: true,
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
  includeSourceDetails: true,
  includeDateInSource: true,
  includeUserInSource: true,
  responseTemplate: true,
  summaryPrompt: true,
});

export const updateSettingsSchema = createInsertSchema(settings).pick({
  openaiModel: true,
  includeSourceDetails: true,
  includeDateInSource: true,
  includeUserInSource: true,
  responseTemplate: true,
  summaryPrompt: true,
  enableDailySchedule: true,
  dailyScheduleTime: true,
  enableWeeklySchedule: true,
  weeklyScheduleDay: true,
  weeklyScheduleTime: true,
  smtpEnabled: true,
  smtpHost: true,
  smtpPort: true,
  smtpUser: true,
  smtpPass: true,
  smtpFrom: true,
});

// Specific schema for email settings updates
export const emailSettingsSchema = z.object({
  smtpEnabled: z.boolean(),
  smtpHost: z.string().nullable(),
  smtpPort: z.string().nullable(),
  smtpUser: z.string().nullable(),
  smtpPass: z.string().nullable(),
  smtpFrom: z.string().nullable(),
});

// Schema for scheduler settings updates
export const schedulerSettingsSchema = z.object({
  enableDailySchedule: z.boolean(),
  dailyScheduleTime: z.string(), // Format: HH:MM
  enableWeeklySchedule: z.boolean(),
  weeklyScheduleDay: z.string(), // Day of week: Monday, Tuesday, etc.
  weeklyScheduleTime: z.string(), // Format: HH:MM
});

export const insertApiTokenSchema = createInsertSchema(apiTokens).pick({
  service: true,
  tokenHash: true,
});

export const updateApiTokenSchema = createInsertSchema(apiTokens).pick({
  tokenHash: true,
});

export const insertUserProjectSchema = createInsertSchema(userProjects).pick({
  userId: true,
  projectId: true,
});

// Project summaries insert schema
export const insertProjectSummarySchema = createInsertSchema(projectSummaries).pick({
  projectId: true,
  content: true,
  week: true,
  slackChannelId: true,
});

// Project email recipients insert schema
export const insertProjectEmailRecipientSchema = createInsertSchema(projectEmailRecipients).pick({
  projectId: true,
  email: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserProject = typeof userProjects.$inferSelect;
export type InsertUserProject = z.infer<typeof insertUserProjectSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

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
export type SchedulerSettings = z.infer<typeof schedulerSettingsSchema>;

export type ApiToken = typeof apiTokens.$inferSelect;
export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type UpdateApiToken = z.infer<typeof updateApiTokenSchema>;

export type ProjectSummary = typeof projectSummaries.$inferSelect;
export type InsertProjectSummary = z.infer<typeof insertProjectSummarySchema>;

export type ProjectEmailRecipient = typeof projectEmailRecipients.$inferSelect;
export type InsertProjectEmailRecipient = z.infer<typeof insertProjectEmailRecipientSchema>;

// Add schema for chatbot-asana project relation
export const insertChatbotAsanaProjectSchema = createInsertSchema(chatbotAsanaProjects).pick({
  chatbotId: true,
  asanaProjectId: true,
  projectName: true,
  projectType: true,
});

// Add types for chatbot-asana project relation
export type ChatbotAsanaProject = typeof chatbotAsanaProjects.$inferSelect;
export type InsertChatbotAsanaProject = z.infer<typeof insertChatbotAsanaProjectSchema>;

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

export const addAsanaProjectSchema = z.object({
  chatbotId: z.number(),
  asanaProjectId: z.string().min(1, "Asana project ID is required"),
  projectName: z.string().min(1, "Project name is required"),
  projectType: z.string().default("main"),
});

export const addProjectEmailRecipientSchema = z.object({
  projectId: z.number(),
  email: z.string().email("Invalid email format"),
});
