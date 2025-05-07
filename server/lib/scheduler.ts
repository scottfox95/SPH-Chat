import cron from 'node-cron';
import { format, subDays, startOfWeek } from 'date-fns';
import { Settings } from '../../shared/schema';
import { IStorage } from '../storage';
import { generateDailySummaryForProject, generateWeeklyProjectSummary } from './summaries';
import { logger } from './logger';

type SchedulerTask = {
  id: string;
  cronJob: cron.ScheduledTask;
};

// Store active scheduled tasks
const scheduledTasks: SchedulerTask[] = [];

/**
 * Parse time string (HH:MM) to cron-format minutes and hours
 * @param timeStr Time string in format HH:MM
 * @returns Object with hours and minutes
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hoursStr, minutesStr] = timeStr.split(':');
  return {
    hours: parseInt(hoursStr, 10),
    minutes: parseInt(minutesStr, 10)
  };
}

/**
 * Convert day of week string to cron day number (0-6, where 0 is Sunday)
 * @param dayName Name of day (Monday, Tuesday, etc.)
 * @returns Cron day number
 */
function getDayNumber(dayName: string): number {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = days.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
  return dayIndex === -1 ? 1 : dayIndex; // Default to Monday if invalid day name
}

/**
 * Initialize summary scheduler based on settings
 * @param settings Application settings
 * @param storage Storage interface
 */
export function initSummaryScheduler(settings: Settings, storage: IStorage): void {
  stopAllScheduledTasks();
  
  // Schedule daily summaries (weekdays only)
  if (settings.enableDailySchedule) {
    const { hours, minutes } = parseTimeString(settings.dailyScheduleTime || '08:00');
    
    // Schedule daily summaries (Monday-Friday)
    // Cron format: Minutes Hours Day-of-month Month Day-of-week
    // 1-5 represents Monday-Friday
    const dailySchedule = `${minutes} ${hours} * * 1-5`;
    
    logger.info(`Setting up daily summary scheduler: ${dailySchedule}`);
    
    const dailyTask = cron.schedule(dailySchedule, async () => {
      logger.info('Running scheduled daily summary generation');
      try {
        // Get all active projects
        const projects = await storage.getAllProjects();
        
        for (const project of projects) {
          // Get project and its chatbots
          const chatbots = await storage.getProjectChatbots(project.id);
          
          if (chatbots.length === 0) {
            logger.info(`Skipping daily summary for project ${project.name} (ID: ${project.id}) - No chatbots found`);
            continue;
          }
          
          const currentDate = new Date();
          const startDate = subDays(currentDate, 1); // Previous 24 hours
          const dateRange = `${format(startDate, 'yyyy-MM-dd')} to ${format(currentDate, 'yyyy-MM-dd')}`;
          logger.info(`Generating daily summary for project ${project.name} (ID: ${project.id}) for dates: ${dateRange}`);
          
          // Get Slack channel ID from project settings or fallback to shared/default channel
          const projectSummarySettings = await storage.getProjectSummarySettings(project.id);
          const slackChannelId = projectSummarySettings?.slackChannelId || null;
          
          if (!slackChannelId) {
            logger.warn(`No Slack channel configured for project ${project.name} (ID: ${project.id}), skipping summary`);
            continue;
          }
          
          // Generate and send daily summary
          await generateDailySummaryForProject(project.id, slackChannelId, storage);
          logger.info(`Daily summary completed for project ${project.name} (ID: ${project.id})`);
        }
      } catch (error) {
        logger.error('Error during scheduled daily summary generation', error);
      }
    });
    
    scheduledTasks.push({
      id: 'daily-summary',
      cronJob: dailyTask
    });
  }
  
  // Schedule weekly summaries (Mondays)
  if (settings.enableWeeklySchedule) {
    const { hours, minutes } = parseTimeString(settings.weeklyScheduleTime || '08:00');
    const dayNumber = getDayNumber(settings.weeklyScheduleDay || 'Monday');
    
    // Schedule weekly summary on the specified day
    const weeklySchedule = `${minutes} ${hours} * * ${dayNumber}`;
    
    logger.info(`Setting up weekly summary scheduler: ${weeklySchedule}`);
    
    const weeklyTask = cron.schedule(weeklySchedule, async () => {
      logger.info('Running scheduled weekly summary generation');
      try {
        // Get all active projects
        const projects = await storage.getAllProjects();
        
        for (const project of projects) {
          // Get project and its chatbots
          const chatbots = await storage.getProjectChatbots(project.id);
          
          if (chatbots.length === 0) {
            logger.info(`Skipping weekly summary for project ${project.name} (ID: ${project.id}) - No chatbots found`);
            continue;
          }
          
          const currentDate = new Date();
          const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // 1 = Monday
          const dateRange = `${format(weekStart, 'yyyy-MM-dd')} to ${format(currentDate, 'yyyy-MM-dd')}`;
          logger.info(`Generating weekly summary for project ${project.name} (ID: ${project.id}) for week: ${dateRange}`);
          
          // Get Slack channel ID from project settings or fallback to shared/default channel
          const projectSummarySettings = await storage.getProjectSummarySettings(project.id);
          const slackChannelId = projectSummarySettings?.slackChannelId || null;
          
          if (!slackChannelId) {
            logger.warn(`No Slack channel configured for project ${project.name} (ID: ${project.id}), skipping summary`);
            continue;
          }
          
          // Generate and send weekly summary
          await generateWeeklyProjectSummary(project.id, slackChannelId, storage);
          logger.info(`Weekly summary completed for project ${project.name} (ID: ${project.id})`);
        }
      } catch (error) {
        logger.error('Error during scheduled weekly summary generation', error);
      }
    });
    
    scheduledTasks.push({
      id: 'weekly-summary',
      cronJob: weeklyTask
    });
  }
  
  logger.info(`Summary scheduler initialized with ${scheduledTasks.length} tasks`);
}

/**
 * Stop all running scheduled tasks
 */
export function stopAllScheduledTasks(): void {
  for (const task of scheduledTasks) {
    task.cronJob.stop();
    logger.info(`Stopped scheduled task: ${task.id}`);
  }
  
  // Clear the array
  scheduledTasks.length = 0;
}

/**
 * Get status of scheduled tasks
 */
export function getSchedulerStatus(): { activeTasks: string[] } {
  return {
    activeTasks: scheduledTasks.map(task => task.id)
  };
}