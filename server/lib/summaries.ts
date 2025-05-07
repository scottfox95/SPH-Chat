import { IStorage } from '../storage';
import { sendSlackMessage } from './slack';
import { generateProjectSummary, generateSimpleSummary } from './openai';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { logger } from './logger';
import { formatHtmlForSlack } from './html-to-slack';

/**
 * Generate and send a daily summary for a project (previous 24 hours)
 * @param projectId Project ID
 * @param slackChannelId Slack channel ID to send the summary to
 * @param storage Storage interface
 * @returns Object with summary results
 */
export async function generateDailySummaryForProject(
  projectId: number,
  slackChannelId: string | null,
  storage: IStorage
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info(`Generating daily summary for project ${projectId}`);
    
    // Get project details
    const project = await storage.getProject(projectId);
    if (!project) {
      logger.error(`Project with ID ${projectId} not found`);
      return { success: false, message: `Project with ID ${projectId} not found` };
    }
    
    // Define date range (last 24 hours)
    const endDate = new Date();
    const startDate = subDays(endDate, 1);
    
    // Format dates for display
    const dateRange = `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    
    // Get all chatbots for this project
    const chatbots = await storage.getProjectChatbots(projectId);
    
    // Prepare content sections for each chatbot
    const chatbotSummaries = [];
    
    // Process each chatbot
    for (const chatbot of chatbots) {
      // Get messages for this chatbot within the date range
      const messages = await storage.getChatbotMessagesByDateRange(chatbot.id, startDate, endDate);
      
      if (messages.length === 0) {
        continue; // Skip chatbots with no messages in the date range
      }
      
      // Generate summary for this chatbot
      const chatbotSummary = await generateChatbotDailySummary(
        chatbot.name,
        messages.map(msg => ({
          role: msg.isUserMessage ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.createdAt
        })),
        dateRange
      );
      
      chatbotSummaries.push(chatbotSummary);
    }
    
    // If no chatbots had activity, return early
    if (chatbotSummaries.length === 0) {
      logger.info(`No activity found for project ${project.name} in the last 24 hours`);
      return { 
        success: true, 
        message: `No activity found for project ${project.name} in the last 24 hours` 
      };
    }
    
    // Combine all summaries into one HTML document
    const fullSummary = `
      <h1>Daily Summary for ${project.name}</h1>
      <p><strong>Date Range:</strong> ${dateRange}</p>
      ${chatbotSummaries.join('')}
    `;
    
    // Store the summary
    await storage.createProjectSummary({
      projectId,
      content: fullSummary,
      week: format(endDate, 'yyyy-MM-dd'),
      slackChannelId: slackChannelId
    });
    
    // Send to Slack if a channel is specified
    if (slackChannelId) {
      const slackFormattedContent = formatHtmlForSlack(fullSummary);
      const slackResponse = await sendSlackMessage(slackChannelId, `Daily Summary for ${project.name}\n\n${slackFormattedContent}`);
      
      return { 
        success: true, 
        message: `Daily summary for project ${project.name} generated and sent to Slack` 
      };
    }
    
    return { 
      success: true, 
      message: `Daily summary for project ${project.name} generated successfully` 
    };
  } catch (error) {
    logger.error('Error generating daily project summary', error);
    return { 
      success: false, 
      message: `Error generating daily summary: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Generate and send a week-to-date summary for a project (current week so far)
 * @param projectId Project ID
 * @param slackChannelId Slack channel ID to send the summary to
 * @param storage Storage interface
 * @returns Object with summary results
 */
export async function generateWeekToDateSummaryForProject(
  projectId: number,
  slackChannelId: string | null,
  storage: IStorage
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info(`Generating week-to-date summary for project ${projectId}`);
    
    // Get project details
    const project = await storage.getProject(projectId);
    if (!project) {
      logger.error(`Project with ID ${projectId} not found`);
      return { success: false, message: `Project with ID ${projectId} not found` };
    }
    
    // Define date range (start of current week to now)
    const endDate = new Date();
    const startDate = startOfWeek(endDate, { weekStartsOn: 1 }); // Week starts on Monday
    
    // Format dates for display
    const dateRange = `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    
    // Get all chatbots for this project
    const chatbots = await storage.getProjectChatbots(projectId);
    
    // Prepare content sections for each chatbot
    const chatbotSummaries = [];
    
    // Process each chatbot
    for (const chatbot of chatbots) {
      // Get messages for this chatbot within the date range
      const messages = await storage.getChatbotMessagesByDateRange(chatbot.id, startDate, endDate);
      
      if (messages.length === 0) {
        continue; // Skip chatbots with no messages in the date range
      }
      
      // Generate summary for this chatbot
      const chatbotSummary = await generateChatbotWeekToDateSummary(
        chatbot.name,
        messages.map(msg => ({
          role: msg.isUserMessage ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.createdAt
        })),
        dateRange
      );
      
      chatbotSummaries.push(chatbotSummary);
    }
    
    // If no chatbots had activity, return early
    if (chatbotSummaries.length === 0) {
      logger.info(`No activity found for project ${project.name} in the current week so far`);
      return { 
        success: true, 
        message: `No activity found for project ${project.name} in the current week so far` 
      };
    }
    
    // Combine all summaries into one HTML document
    const fullSummary = `
      <h1>Week-to-Date Summary for ${project.name}</h1>
      <p><strong>Date Range:</strong> ${dateRange}</p>
      ${chatbotSummaries.join('')}
    `;
    
    // Store the summary
    await storage.createProjectSummary({
      projectId,
      content: fullSummary,
      week: format(endDate, 'yyyy-MM-dd'),
      slackChannelId: slackChannelId
    });
    
    // Send to Slack if a channel is specified
    if (slackChannelId) {
      const slackFormattedContent = formatHtmlForSlack(fullSummary);
      const slackResponse = await sendSlackMessage(slackChannelId, `Week-to-Date Summary for ${project.name}\n\n${slackFormattedContent}`);
      
      return { 
        success: true, 
        message: `Week-to-date summary for project ${project.name} generated and sent to Slack` 
      };
    }
    
    return { 
      success: true, 
      message: `Week-to-date summary for project ${project.name} generated successfully` 
    };
  } catch (error) {
    logger.error('Error generating week-to-date project summary', error);
    return { 
      success: false, 
      message: `Error generating week-to-date summary: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Generate and send a weekly summary for a project (full week)
 * @param projectId Project ID
 * @param slackChannelId Slack channel ID to send the summary to
 * @param storage Storage interface
 * @returns Object with summary results
 */
export async function generateWeeklyProjectSummary(
  projectId: number,
  slackChannelId: string | null,
  storage: IStorage
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info(`Generating weekly summary for project ${projectId}`);
    
    // Get project details
    const project = await storage.getProject(projectId);
    if (!project) {
      logger.error(`Project with ID ${projectId} not found`);
      return { success: false, message: `Project with ID ${projectId} not found` };
    }
    
    // Define date range (previous week)
    const now = new Date();
    const endDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const startDate = subDays(endDate, 7); // Previous Monday
    
    // Format dates for display
    const dateRange = `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    
    // Get all chatbots for this project
    const chatbots = await storage.getProjectChatbots(projectId);
    
    // Prepare content sections for each chatbot
    const chatbotSummaries = [];
    
    // Process each chatbot
    for (const chatbot of chatbots) {
      // Get messages for this chatbot within the date range
      const messages = await storage.getChatbotMessagesByDateRange(chatbot.id, startDate, endDate);
      
      if (messages.length === 0) {
        continue; // Skip chatbots with no messages in the date range
      }
      
      // Generate summary for this chatbot
      const chatbotSummary = await generateChatbotWeeklySummary(
        chatbot.name,
        messages.map(msg => ({
          role: msg.isUserMessage ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.createdAt
        })),
        dateRange
      );
      
      chatbotSummaries.push(chatbotSummary);
    }
    
    // If no chatbots had activity, return early
    if (chatbotSummaries.length === 0) {
      logger.info(`No activity found for project ${project.name} in the previous week`);
      return { 
        success: true, 
        message: `No activity found for project ${project.name} in the previous week` 
      };
    }
    
    // Combine all summaries into one HTML document
    const fullSummary = `
      <h1>Weekly Summary for ${project.name}</h1>
      <p><strong>Date Range:</strong> ${dateRange}</p>
      ${chatbotSummaries.join('')}
    `;
    
    // Store the summary
    await storage.createProjectSummary({
      projectId,
      content: fullSummary,
      week: format(endDate, 'yyyy-MM-dd'),
      slackChannelId: slackChannelId
    });
    
    // Send to Slack if a channel is specified
    if (slackChannelId) {
      const slackFormattedContent = formatHtmlForSlack(fullSummary);
      const slackResponse = await sendSlackMessage(slackChannelId, `Weekly Summary for ${project.name}\n\n${slackFormattedContent}`);
      
      return { 
        success: true, 
        message: `Weekly summary for project ${project.name} generated and sent to Slack` 
      };
    }
    
    return { 
      success: true, 
      message: `Weekly summary for project ${project.name} generated successfully` 
    };
  } catch (error) {
    logger.error('Error generating weekly project summary', error);
    return { 
      success: false, 
      message: `Error generating weekly summary: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Generate a daily summary for a chatbot
 * @param chatbotName Name of the chatbot
 * @param messages Array of messages for this chatbot
 * @param dateRange Date range string for the summary (e.g., "May 1 - May 2, 2025")
 * @returns Summary content as HTML
 */
async function generateChatbotDailySummary(
  chatbotName: string, 
  messages: { role: string; content: string; timestamp: Date }[],
  dateRange: string
): Promise<string> {
  try {
    const prompt = `
      Create a concise daily summary of the following conversation between a user and an AI assistant.
      Focus on the key topics discussed, important decisions made, and any action items identified.
      Format the output in HTML with appropriate headers and bullet points.
      Conversation time frame: ${dateRange}
      Chatbot: ${chatbotName}
    `;
    
    const aiSummary = await generateAISummary(prompt, messages);
    
    // Wrap in a section with the chatbot name as a header
    return `
      <div class="chatbot-summary">
        <h2>${chatbotName}</h2>
        ${aiSummary}
      </div>
    `;
  } catch (error) {
    logger.error(`Error generating chatbot daily summary for ${chatbotName}`, error);
    return `
      <div class="chatbot-summary">
        <h2>${chatbotName}</h2>
        <p>Error generating summary: ${error instanceof Error ? error.message : String(error)}</p>
      </div>
    `;
  }
}

/**
 * Generate a week-to-date summary for a chatbot
 * @param chatbotName Name of the chatbot
 * @param messages Array of messages for this chatbot
 * @param dateRange Date range string for the summary (e.g., "May 1 - May 5, 2025")
 * @returns Summary content as HTML
 */
async function generateChatbotWeekToDateSummary(
  chatbotName: string, 
  messages: { role: string; content: string; timestamp: Date }[],
  dateRange: string
): Promise<string> {
  try {
    const prompt = `
      Create a concise week-to-date summary of the following conversation between a user and an AI assistant.
      Focus on the key topics discussed, important decisions made, and any action items identified.
      Organize by main themes/topics, not by day.
      Format the output in HTML with appropriate headers and bullet points.
      Conversation time frame: ${dateRange}
      Chatbot: ${chatbotName}
    `;
    
    const aiSummary = await generateAISummary(prompt, messages);
    
    // Wrap in a section with the chatbot name as a header
    return `
      <div class="chatbot-summary">
        <h2>${chatbotName}</h2>
        ${aiSummary}
      </div>
    `;
  } catch (error) {
    logger.error(`Error generating chatbot week-to-date summary for ${chatbotName}`, error);
    return `
      <div class="chatbot-summary">
        <h2>${chatbotName}</h2>
        <p>Error generating summary: ${error instanceof Error ? error.message : String(error)}</p>
      </div>
    `;
  }
}

/**
 * Generate a weekly summary for a chatbot
 * @param chatbotName Name of the chatbot
 * @param messages Array of messages for this chatbot
 * @param dateRange Date range string for the summary (e.g., "May 1 - May 7, 2025")
 * @returns Summary content as HTML
 */
async function generateChatbotWeeklySummary(
  chatbotName: string, 
  messages: { role: string; content: string; timestamp: Date }[],
  dateRange: string
): Promise<string> {
  try {
    const prompt = `
      Create a detailed weekly summary of the following conversation between a user and an AI assistant.
      Focus on the key topics discussed, important decisions made, and any action items identified.
      Organize by main themes/topics, not by day.
      Format the output in HTML with appropriate headers and bullet points.
      Conversation time frame: ${dateRange}
      Chatbot: ${chatbotName}
    `;
    
    const aiSummary = await generateAISummary(prompt, messages);
    
    // Wrap in a section with the chatbot name as a header
    return `
      <div class="chatbot-summary">
        <h2>${chatbotName}</h2>
        ${aiSummary}
      </div>
    `;
  } catch (error) {
    logger.error(`Error generating chatbot weekly summary for ${chatbotName}`, error);
    return `
      <div class="chatbot-summary">
        <h2>${chatbotName}</h2>
        <p>Error generating summary: ${error instanceof Error ? error.message : String(error)}</p>
      </div>
    `;
  }
}

/**
 * Generate a summary from messages using AI
 * @param prompt The prompt for the AI
 * @param messages Array of messages
 * @returns Summary content
 */
async function generateAISummary(
  prompt: string,
  messages: { role: string; content: string; timestamp: Date }[]
): Promise<string> {
  try {
    // Format the messages for the AI
    const formattedMessages = messages.map(msg => {
      const timestamp = format(msg.timestamp, 'MMM d, yyyy h:mm a');
      return `[${timestamp}] ${msg.role.toUpperCase()}: ${msg.content}`;
    }).join('\n\n');
    
    // Generate a summary using OpenAI
    const fullPrompt = `${prompt}\n\nCONVERSATION:\n${formattedMessages}`;
    
    const summaryResponse = await generateSimpleSummary(fullPrompt, formattedMessages);
    return summaryResponse;
  } catch (error) {
    logger.error('Error generating AI summary', error);
    throw error;
  }
}