import { db, pool } from "../db";
import * as fs from "fs";
import * as path from "path";
import { storage } from "../storage";
import { 
  users, chatbots, documents, messages, summaries, emailRecipients, chatbotAsanaProjects,
  type InsertDocument, type InsertEmailRecipient, type InsertSummary, type InsertMessage
} from "@shared/schema";

/**
 * Data migration utility for SPH Chat application
 * 
 * This module provides functions to export data from and import data into
 * the database, ensuring that development data is preserved when deployed.
 */

// File path for the exported data
const DATA_EXPORT_PATH = path.join(process.cwd(), 'data-export.json');

/**
 * Check whether a migration is needed
 * 
 * @returns {Promise<boolean>} True if migration is needed, false otherwise
 */
export async function isMigrationNeeded(): Promise<boolean> {
  try {
    // Always perform migration in production regardless of current data
    // This ensures that any chatbots created in development are available in production
    const isProduction = process.env.NODE_ENV === 'production';
    console.log(`Checking migration need - Environment: ${process.env.NODE_ENV}, IsProduction: ${isProduction}`);
    
    if (!isProduction) {
      console.log("Not in production environment, skipping migration");
      return false; // Only migrate in production
    }
    
    // Check if we have any exported data to import
    if (!fs.existsSync(DATA_EXPORT_PATH)) {
      console.log(`No export data file found at ${DATA_EXPORT_PATH}`);
      return false; // No exported data to import
    }
    
    // Load and validate export data
    try {
      const exportDataRaw = fs.readFileSync(DATA_EXPORT_PATH, 'utf8');
      const exportData = JSON.parse(exportDataRaw);
      
      // Check if we have meaningful data in the export
      if (!exportData.chatbots || exportData.chatbots.length === 0) {
        console.log("Export data exists but contains no chatbots");
        return false;
      }
      
      console.log(`Found ${exportData.chatbots.length} chatbots in export data`);
      
      // Now count chatbots in the production database
      const chatbotCount = await getChatbotCount();
      console.log(`Found ${chatbotCount} chatbots in production database`);
      
      // Migration is needed if:
      // 1. We have no chatbots in production but have them in export data, or
      // 2. We have fewer chatbots in production than in the export data
      const needsMigration = chatbotCount < exportData.chatbots.length;
      console.log(`Migration needed: ${needsMigration}`);
      return needsMigration;
      
    } catch (parseError) {
      console.error("Error parsing export data:", parseError);
      return false;
    }
  } catch (error) {
    console.error("Error checking migration status:", error);
    return false;
  }
}

/**
 * Get the count of chatbots in the database
 * 
 * @returns {Promise<number>} The count of chatbots
 */
async function getChatbotCount(): Promise<number> {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM chatbots');
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error("Error counting chatbots:", error);
    return 0;
  }
}

/**
 * Get the count of users in the database
 * 
 * @returns {Promise<number>} The count of users
 */
async function getUserCount(): Promise<number> {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error("Error counting users:", error);
    return 0;
  }
}

/**
 * Export data to a JSON file
 * 
 * @returns {Promise<boolean>} True if export was successful, false otherwise
 */
export async function exportData(): Promise<boolean> {
  try {
    console.log("Exporting data to:", DATA_EXPORT_PATH);
    
    // Get data from the database
    const allUsers = await storage.getUsers();
    const allChatbots = await storage.getChatbots();
    
    // Get related data for each chatbot
    const chatbotData = await Promise.all(allChatbots.map(async (chatbot) => {
      const documents = await storage.getDocuments(chatbot.id);
      const messages = await storage.getMessages(chatbot.id, 1000); // Get up to 1000 messages
      const summaries = await storage.getSummaries(chatbot.id);
      const emailRecipients = await storage.getEmailRecipients(chatbot.id);
      const asanaProjects = await storage.getChatbotAsanaProjects(chatbot.id);
      
      return {
        chatbot,
        documents,
        messages,
        summaries,
        emailRecipients,
        asanaProjects
      };
    }));
    
    // Create the export data object
    const exportData = {
      users: allUsers,
      chatbots: chatbotData,
      exportedAt: new Date().toISOString(),
      exportedBy: "SPH Chat Migration Utility"
    };
    
    // Write data to file
    fs.writeFileSync(DATA_EXPORT_PATH, JSON.stringify(exportData, null, 2));
    
    console.log("Data export completed successfully");
    return true;
  } catch (error) {
    console.error("Error exporting data:", error);
    return false;
  }
}

/**
 * Import data from a JSON file
 * 
 * @returns {Promise<boolean>} True if import was successful, false otherwise
 */
export async function importData(): Promise<boolean> {
  try {
    if (!fs.existsSync(DATA_EXPORT_PATH)) {
      console.log("No exported data found at:", DATA_EXPORT_PATH);
      return false;
    }
    
    console.log("Importing data from:", DATA_EXPORT_PATH);
    
    // Read data from file
    const exportDataRaw = fs.readFileSync(DATA_EXPORT_PATH, 'utf8');
    const exportData = JSON.parse(exportDataRaw);
    
    // Start transaction
    await pool.query('BEGIN');
    
    // First, import users
    console.log(`Importing ${exportData.users.length} users...`);
    for (const user of exportData.users) {
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(user.username);
      if (!existingUser) {
        await storage.createUser({
          username: user.username,
          password: user.password,
          displayName: user.displayName,
          initial: user.initial,
          role: user.role
        });
        console.log(`Created user: ${user.username}`);
      } else {
        console.log(`User already exists: ${user.username}`);
      }
    }
    
    // Next, import chatbots and their related data
    console.log(`Importing ${exportData.chatbots.length} chatbots...`);
    for (const chatbotData of exportData.chatbots) {
      const { chatbot, documents, messages, summaries, emailRecipients, asanaProjects } = chatbotData;
      
      // Check if chatbot already exists (by name + created by)
      const existingChatbots = await storage.getChatbots();
      const existingChatbot = existingChatbots.find(c => 
        c.name === chatbot.name && c.createdById === chatbot.createdById
      );
      
      let chatbotId;
      if (!existingChatbot) {
        try {
          // With UUID column type and default value, we don't need to specify the token
          // Let PostgreSQL generate a UUID automatically
          const result = await pool.query(
            `INSERT INTO chatbots (
              name, slack_channel_id, asana_project_id, created_by_id, 
              is_active, require_auth, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, public_token`,
            [
              chatbot.name,
              chatbot.slackChannelId,
              chatbot.asanaProjectId,
              chatbot.createdById,
              chatbot.isActive,
              chatbot.requireAuth,
              chatbot.createdAt || new Date()
            ]
          );
          
          chatbotId = result.rows[0].id;
          const newPublicToken = result.rows[0].public_token;
          console.log(`Created chatbot with UUID token: ${newPublicToken}`);
          
          // Update the original object's token for reference in later operations
          chatbot.publicToken = newPublicToken;
          
          console.log(`Created chatbot: ${chatbot.name} (ID: ${chatbotId})`);
        } catch (error) {
          console.error(`Error creating chatbot ${chatbot.name}:`, error);
          
          // Fall back to standard method which will generate a new token
          const createdChatbot = await storage.createChatbot({
            name: chatbot.name,
            slackChannelId: chatbot.slackChannelId,
            asanaProjectId: chatbot.asanaProjectId,
            createdById: chatbot.createdById,
            isActive: chatbot.isActive,
            requireAuth: chatbot.requireAuth
          });
          chatbotId = createdChatbot.id;
          console.log(`Created chatbot with fallback method: ${chatbot.name} (ID: ${chatbotId})`);
        }
      } else {
        chatbotId = existingChatbot.id;
        console.log(`Chatbot already exists: ${chatbot.name} (ID: ${chatbotId})`);
      }
      
      // Import documents
      for (const doc of documents) {
        // Check if document already exists
        const existingDocs = await storage.getDocuments(chatbotId);
        const existingDoc = existingDocs.find(d => d.filename === doc.filename);
        
        if (!existingDoc) {
          const documentData: InsertDocument = {
            chatbotId: chatbotId,
            filename: doc.filename,
            originalName: doc.originalName || doc.filename,
            fileType: doc.fileType || 'text/plain',
            uploadedById: doc.uploadedById || chatbot.createdById
          };
          
          await storage.createDocument(documentData);
          console.log(`Created document: ${doc.originalName || doc.filename} for chatbot ID ${chatbotId}`);
        }
      }
      
      // Import email recipients
      for (const recipient of emailRecipients) {
        // Check if email recipient already exists
        const existingRecipients = await storage.getEmailRecipients(chatbotId);
        const existingRecipient = existingRecipients.find(r => r.email === recipient.email);
        
        if (!existingRecipient) {
          const emailData: InsertEmailRecipient = {
            chatbotId: chatbotId,
            email: recipient.email
          };
          
          await storage.createEmailRecipient(emailData);
          console.log(`Created email recipient: ${recipient.email} for chatbot ID ${chatbotId}`);
        }
      }
      
      // Import Asana projects
      for (const project of asanaProjects) {
        // Check if project already exists
        const existingProjects = await storage.getChatbotAsanaProjects(chatbotId);
        const existingProject = existingProjects.find(p => p.asanaProjectId === project.asanaProjectId);
        
        if (!existingProject) {
          await storage.addChatbotAsanaProject({
            chatbotId: chatbotId,
            asanaProjectId: project.asanaProjectId,
            projectName: project.projectName || `Project ${project.asanaProjectId}`,
            projectType: project.projectType || 'main'
          });
          console.log(`Created Asana project: ${project.projectName || project.asanaProjectId} for chatbot ID ${chatbotId}`);
        }
      }
      
      // Import summaries (optional, as these can be regenerated)
      for (const summary of summaries) {
        // Check if summary already exists
        const existingSummaries = await storage.getSummaries(chatbotId);
        const existingSummary = existingSummaries.find(s => s.week === summary.week);
        
        if (!existingSummary) {
          const summaryData: InsertSummary = {
            chatbotId: chatbotId,
            content: summary.content,
            week: summary.week || `Week-${new Date().toISOString().split('T')[0]}`
          };
          
          await storage.createSummary(summaryData);
          console.log(`Created summary for week ${summary.week} for chatbot ID ${chatbotId}`);
        }
      }
      
      // Import messages (we'll import the last 50 to avoid importing too much)
      const messagesToImport = messages.slice(-50);
      for (const message of messagesToImport) {
        const messageData: InsertMessage = {
          chatbotId: chatbotId,
          content: message.content,
          isUserMessage: message.isUserMessage || message.role === 'user',
          userId: message.userId || null,
          citation: message.citation || null
        };
        
        await storage.createMessage(messageData);
      }
      console.log(`Imported ${messagesToImport.length} messages for chatbot ID ${chatbotId}`);
    }
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log("Data import completed successfully");
    return true;
  } catch (error) {
    // Rollback transaction on error
    await pool.query('ROLLBACK');
    console.error("Error importing data:", error);
    return false;
  }
}

/**
 * Run the migration process if needed
 * 
 * This function checks if migration is needed and, if so, imports data.
 * It also exports data regardless, to ensure the latest data is available.
 * 
 * @returns {Promise<void>}
 */
export async function runMigration(): Promise<void> {
  try {
    // Always export data
    await exportData();
    
    // Check if migration is needed
    const needsMigration = await isMigrationNeeded();
    
    if (needsMigration) {
      console.log("Migration is needed. Importing data...");
      await importData();
    } else {
      console.log("Migration is not needed. Skipping import.");
    }
  } catch (error) {
    console.error("Error running migration:", error);
  }
}