import nodemailer from "nodemailer";
import { storage } from "../storage";

// Configure email transporter
// For development, we'll use a ethereal test account
let transporter: nodemailer.Transporter;

async function createTestAccount() {
  const testAccount = await nodemailer.createTestAccount();
  
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  
  console.log("Test email account created:", testAccount.user);
  console.log("Test email password:", testAccount.pass);
  console.log("View emails at https://ethereal.email");
}

// Use environment variables in production
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // Create test account for development
  createTestAccount();
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
    
    // Send email to all recipients
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"SPH ChatBot" <homebuilder@example.com>',
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
    
    // Send email to all project recipients
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"SPH Project Summary" <projects@example.com>',
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
