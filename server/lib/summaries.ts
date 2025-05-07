import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { IStorage } from '../storage';
import { generateProjectSummaryWithAI } from './openai';
import { sendProjectSummaryToSlack } from './slack';
import { logger } from './logger';

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
): Promise<{ summary: any, slackSent: boolean }> {
  try {
    // Get project and its chatbots
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    
    const chatbots = await storage.getProjectChatbots(projectId);
    if (chatbots.length === 0) {
      throw new Error(`No chatbots found for project ${project.name} (ID: ${projectId})`);
    }
    
    // Set date range for daily summary (last 24 hours)
    const endDate = new Date();
    const startDate = subDays(endDate, 1);
    
    // Format date range for the summary
    const dateRangeStr = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    
    // Generate chatbot summaries for the last 24 hours
    const chatbotSummaries = [];
    for (const chatbot of chatbots) {
      // Get recent messages for this chatbot within the date range
      const messages = await storage.getChatbotMessagesByDateRange(
        chatbot.id,
        startDate,
        endDate
      );
      
      if (messages.length > 0) {
        // Format messages for AI processing
        const messagesForAI = messages.map(msg => ({
          role: msg.isUserMessage ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.createdAt
        }));
        
        try {
          const summaryContent = await generateChatbotDailySummary(
            chatbot.name,
            messagesForAI,
            dateRangeStr
          );
          
          chatbotSummaries.push({
            chatbotId: chatbot.id,
            chatbotName: chatbot.name,
            content: summaryContent
          });
        } catch (error) {
          logger.error(`Error generating daily summary for chatbot ${chatbot.name}`, error);
        }
      } else {
        logger.info(`No messages found for chatbot ${chatbot.name} in the last 24 hours. Skipping summary.`);
      }
    }
    
    // If no chatbot has messages, return early
    if (chatbotSummaries.length === 0) {
      logger.info(`No activities found for project ${project.name} in the last 24 hours. Skipping summary.`);
      return { summary: null, slackSent: false };
    }
    
    // Generate project summary using AI
    const projectSummaryContent = await generateProjectSummaryWithAI(
      chatbotSummaries,
      project.name,
      `Daily Summary (${dateRangeStr})`,
      'daily'
    );
    
    // Store project summary
    const projectSummary = await storage.createProjectSummary({
      projectId,
      content: projectSummaryContent,
      week: `Daily-${format(endDate, 'yyyy-MM-dd')}`,
      slackChannelId: slackChannelId || undefined
    });
    
    // Send to Slack if a channel ID was provided
    let slackResult = false;
    if (slackChannelId) {
      slackResult = await sendProjectSummaryToSlack(
        slackChannelId,
        project.name,
        projectSummaryContent,
        chatbots.length,
        'Daily'
      );
    }
    
    return {
      summary: projectSummary,
      slackSent: !!slackResult
    };
  } catch (error) {
    logger.error('Error generating daily project summary', error);
    throw error;
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
): Promise<{ summary: any, slackSent: boolean }> {
  try {
    // Get project and its chatbots
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    
    const chatbots = await storage.getProjectChatbots(projectId);
    if (chatbots.length === 0) {
      throw new Error(`No chatbots found for project ${project.name} (ID: ${projectId})`);
    }
    
    // Set date range for week-to-date summary
    const endDate = new Date();
    const startDate = startOfWeek(endDate, { weekStartsOn: 1 }); // Start from Monday
    
    // Format date range for the summary
    const dateRangeStr = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    
    // Generate chatbot summaries for the week-to-date
    const chatbotSummaries = [];
    for (const chatbot of chatbots) {
      // Get messages for this chatbot within the date range
      const messages = await storage.getChatbotMessagesByDateRange(
        chatbot.id,
        startDate,
        endDate
      );
      
      if (messages.length > 0) {
        // Format messages for AI processing
        const messagesForAI = messages.map(msg => ({
          role: msg.isUserMessage ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.createdAt
        }));
        
        try {
          const summaryContent = await generateChatbotWeekToDateSummary(
            chatbot.name,
            messagesForAI,
            dateRangeStr
          );
          
          chatbotSummaries.push({
            chatbotId: chatbot.id,
            chatbotName: chatbot.name,
            content: summaryContent
          });
        } catch (error) {
          logger.error(`Error generating week-to-date summary for chatbot ${chatbot.name}`, error);
        }
      } else {
        logger.info(`No messages found for chatbot ${chatbot.name} in the current week. Skipping summary.`);
      }
    }
    
    // If no chatbot has messages, return early
    if (chatbotSummaries.length === 0) {
      logger.info(`No activities found for project ${project.name} in the current week. Skipping summary.`);
      return { summary: null, slackSent: false };
    }
    
    // Generate project summary using AI
    const projectSummaryContent = await generateProjectSummaryWithAI(
      chatbotSummaries,
      project.name,
      `Week-to-Date Summary (${dateRangeStr})`,
      'week-to-date'
    );
    
    // Store project summary
    const projectSummary = await storage.createProjectSummary({
      projectId,
      content: projectSummaryContent,
      week: `WeekToDate-${format(endDate, 'yyyy-MM-dd')}`,
      slackChannelId: slackChannelId || undefined
    });
    
    // Send to Slack if a channel ID was provided
    let slackResult = false;
    if (slackChannelId) {
      slackResult = await sendProjectSummaryToSlack(
        slackChannelId,
        project.name,
        projectSummaryContent,
        chatbots.length,
        'Week-to-Date'
      );
    }
    
    return {
      summary: projectSummary,
      slackSent: !!slackResult
    };
  } catch (error) {
    logger.error('Error generating week-to-date project summary', error);
    throw error;
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
): Promise<{ summary: any, slackSent: boolean }> {
  try {
    // Get project and its chatbots
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    
    const chatbots = await storage.getProjectChatbots(projectId);
    if (chatbots.length === 0) {
      throw new Error(`No chatbots found for project ${project.name} (ID: ${projectId})`);
    }
    
    // Set date range for weekly summary (previous week)
    const currentDate = new Date();
    const endOfLastWeek = subDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 1);
    const startOfLastWeek = startOfWeek(endOfLastWeek, { weekStartsOn: 1 });
    
    // Format date range for the summary
    const dateRangeStr = `${format(startOfLastWeek, 'MMM d')} - ${format(endOfLastWeek, 'MMM d, yyyy')}`;
    
    // Generate chatbot summaries for each chatbot
    const chatbotSummaries = [];
    for (const chatbot of chatbots) {
      // Get messages for this chatbot within the week
      const messages = await storage.getChatbotMessagesByDateRange(
        chatbot.id,
        startOfLastWeek,
        endOfLastWeek
      );
      
      if (messages.length > 0) {
        // Format messages for AI processing
        const messagesForAI = messages.map(msg => ({
          role: msg.isUserMessage ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.createdAt
        }));
        
        try {
          const summaryContent = await generateChatbotWeeklySummary(
            chatbot.name,
            messagesForAI,
            dateRangeStr
          );
          
          chatbotSummaries.push({
            chatbotId: chatbot.id,
            chatbotName: chatbot.name,
            content: summaryContent
          });
        } catch (error) {
          logger.error(`Error generating weekly summary for chatbot ${chatbot.name}`, error);
        }
      } else {
        logger.info(`No messages found for chatbot ${chatbot.name} in the past week. Skipping summary.`);
      }
    }
    
    // If no chatbot has messages, return early
    if (chatbotSummaries.length === 0) {
      logger.info(`No activities found for project ${project.name} in the past week. Skipping summary.`);
      return { summary: null, slackSent: false };
    }
    
    // Generate project summary using AI
    const projectSummaryContent = await generateProjectSummaryWithAI(
      chatbotSummaries,
      project.name,
      `Weekly Summary (${dateRangeStr})`,
      'weekly'
    );
    
    // Create week string in format "YYYY-WW" (year and week number)
    const weekStr = `${format(startOfLastWeek, 'yyyy')}-W${format(startOfLastWeek, 'ww')}`;
    
    // Store project summary
    const projectSummary = await storage.createProjectSummary({
      projectId,
      content: projectSummaryContent,
      week: weekStr,
      slackChannelId: slackChannelId || undefined
    });
    
    // Send to Slack if a channel ID was provided
    let slackResult = false;
    if (slackChannelId) {
      slackResult = await sendProjectSummaryToSlack(
        slackChannelId,
        project.name,
        projectSummaryContent,
        chatbots.length,
        'Weekly'
      );
    }
    
    return {
      summary: projectSummary,
      slackSent: !!slackResult
    };
  } catch (error) {
    logger.error('Error generating weekly project summary', error);
    throw error;
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
  // For now, we're reusing the weekly summary prompt with slight modifications
  const prompt = `Generate a concise daily summary for ${chatbotName} covering the period ${dateRange}. 
Focus on key updates, progress made, issues raised, and next steps. 
Organize the summary into sections if appropriate:
1. Key Progress
2. Issues & Blockers
3. Next Steps

Format the response as HTML with appropriate headings, paragraphs, and lists.`;

  try {
    const aiResponse = await generateAISummary(prompt, messages);
    return aiResponse;
  } catch (error) {
    logger.error(`Error generating daily AI summary for ${chatbotName}`, error);
    throw error;
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
  const prompt = `Generate a concise week-to-date summary for ${chatbotName} covering the period from ${dateRange}. 
Focus on key updates, progress made, issues raised, and next steps. 
Organize the summary into sections if appropriate:
1. Weekly Overview
2. Key Progress
3. Issues & Blockers
4. Next Steps

Format the response as HTML with appropriate headings, paragraphs, and lists.`;

  try {
    const aiResponse = await generateAISummary(prompt, messages);
    return aiResponse;
  } catch (error) {
    logger.error(`Error generating week-to-date AI summary for ${chatbotName}`, error);
    throw error;
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
  const prompt = `Generate a comprehensive weekly summary for ${chatbotName} covering the period ${dateRange}. 
Focus on key updates, progress made, issues raised, and next steps. 
Organize the summary into sections:
1. Weekly Overview
2. Key Progress
3. Issues & Blockers
4. Next Steps / Action Items

Format the response as HTML with appropriate headings, paragraphs, and lists.`;

  try {
    const aiResponse = await generateAISummary(prompt, messages);
    return aiResponse;
  } catch (error) {
    logger.error(`Error generating weekly AI summary for ${chatbotName}`, error);
    throw error;
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
  // This is a placeholder that will use the OpenAI module
  // The actual implementation should use the existing OpenAI module
  // For now, we'll assume this function exists in the OpenAI module
  
  // In a real implementation, we would call something like:
  // return openai.generateSummary(prompt, messages);
  
  // For this stub, we'll return a placeholder
  return "<h3>Summary content will be generated by AI</h3><p>This is a placeholder for the actual AI-generated summary.</p>";
}