import nodemailer from "nodemailer";
import { storage } from "../storage";

// We'll create the transporter dynamically for each email
// to ensure we always have the latest settings
let testAccount: { user: string, pass: string } | null = null;

// Helper function to get or create an email transporter
async function getTransporter() {
  // First, check if SMTP is configured in environment variables
  // This is populated by the settings API when settings are updated
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log("Using configured SMTP server:", process.env.SMTP_HOST);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Next, check the database for settings
  // (Though they should have been loaded into env vars)
  const settings = await storage.getSettings();
  if (settings.smtpEnabled && settings.smtpHost && settings.smtpUser && settings.smtpPass) {
    console.log("Using SMTP settings from database:", settings.smtpHost);
    // Update environment variables for future use
    process.env.SMTP_HOST = settings.smtpHost;
    process.env.SMTP_PORT = settings.smtpPort || "587";
    process.env.SMTP_USER = settings.smtpUser;
    process.env.SMTP_PASS = settings.smtpPass;
    if (settings.smtpFrom) {
      process.env.SMTP_FROM = settings.smtpFrom;
    }
    
    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: parseInt(settings.smtpPort || "587"),
      secure: false, // Use TLS, not SSL
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });
  }
  
  // As a fallback, use ethereal test account for development
  if (!testAccount) {
    testAccount = await nodemailer.createTestAccount();
    console.log("Test email account created:", testAccount.user);
    console.log("Test email password:", testAccount.pass);
    console.log("View emails at https://ethereal.email");
  }
  
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

/**
 * Sends weekly summary emails to recipients
 * @param chatbotId The ID of the chatbot
 * @param subject Email subject
 * @param htmlContent HTML content of the email
 * @returns Result of the email sending operation
 */
export async function sendSummaryEmail(
  chatbotId: number,
  subject: string,
  htmlContent: string
) {
  try {
    // Get recipients for this chatbot
    const recipients = await storage.getEmailRecipients(chatbotId);
    
    if (recipients.length === 0) {
      return { success: false, message: "No recipients found" };
    }
    
    // Get chatbot details
    const chatbot = await storage.getChatbot(chatbotId);
    
    if (!chatbot) {
      return { success: false, message: "Chatbot not found" };
    }
    
    // Get a transporter with the latest settings
    const transporter = await getTransporter();
    
    // Get the "from" address from settings or environment variables
    const settings = await storage.getSettings();
    const fromAddress = process.env.SMTP_FROM || 
                        settings?.smtpFrom || 
                        '"SPH ChatBot" <homebuilder@example.com>';
    
    // Send email to all recipients
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipients.map((r) => r.email).join(", "),
      subject: subject || `Weekly Summary: ${chatbot.name}`,
      html: htmlContent,
    });
    
    console.log("Email sent:", info.messageId);
    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error };
  }
}

/**
 * Sends project-level weekly summary emails to recipients
 * @param projectId The ID of the project
 * @param subject Email subject
 * @param htmlContent HTML content of the email
 * @returns Result of the email sending operation
 */
export async function sendProjectSummaryEmail(
  projectId: number,
  subject: string,
  htmlContent: string
) {
  try {
    // Get recipients for this project
    const recipients = await storage.getProjectEmailRecipients(projectId);
    
    if (recipients.length === 0) {
      return { success: false, message: "No project recipients found" };
    }
    
    // Get project details
    const project = await storage.getProject(projectId);
    
    if (!project) {
      return { success: false, message: "Project not found" };
    }
    
    // Get a transporter with the latest settings
    const transporter = await getTransporter();
    
    // Get the "from" address from settings or environment variables
    const settings = await storage.getSettings();
    const fromAddress = process.env.SMTP_FROM || 
                        settings?.smtpFrom || 
                        '"SPH Project Summary" <projects@example.com>';
    
    // Send email to all project recipients
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipients.map((r) => r.email).join(", "),
      subject: subject || `Weekly Project Summary: ${project.name}`,
      html: htmlContent,
    });
    
    console.log("Project summary email sent:", info.messageId);
    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending project summary email:", error);
    return { success: false, error };
  }
}
