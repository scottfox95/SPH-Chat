import * as cron from 'node-cron';
import { IStorage, Settings } from '../storage';
import { format } from 'date-fns';
import { storage } from '../storage';
import { generateDailySummaryForProject, generateWeekToDateSummaryForProject, generateWeeklyProjectSummary } from './summaries';
import { logger } from './logger';

// Store active scheduled tasks
type SchedulerTask = {
  id: string;
  cronJob: cron.ScheduledTask;
};

const scheduledTasks: SchedulerTask[] = [];

/**
 * Parse time string (HH:MM) to cron-format minutes and hours
 * @param timeStr Time string in format HH:MM
 * @returns Object with hours and minutes
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  } catch (error) {
    logger.error(`Invalid time format: ${timeStr}`, error);
    // Default to 8:00 AM
    return { hours: 8, minutes: 0 };
  }
}

/**
 * Convert day of week string to cron day number (0-6, where 0 is Sunday)
 * @param dayName Name of day (Monday, Tuesday, etc.)
 * @returns Cron day number
 */
function getDayNumber(dayName: string): number {
  const days = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6
  };
  
  return days[dayName as keyof typeof days] ?? 1; // Default to Monday
}

/**
 * Initialize summary scheduler based on settings
 * @param settings Application settings
 * @param storage Storage interface
 */
export function initSummaryScheduler(settings: Settings, storage: IStorage): void {
  // Clear any existing scheduled tasks
  stopAllScheduledTasks();
  
  try {
    // Schedule daily summaries if enabled
    if (settings.enableDailySchedule) {
      const { hours, minutes } = parseTimeString(settings.dailyScheduleTime);
      
      // Create cron expression for weekdays only (Monday-Friday)
      // Format: minute hour * * dayOfWeek
      const cronExpression = `${minutes} ${hours} * * 1-5`;
      
      logger.info(`Setting up daily summary scheduler: ${cronExpression}`);
      
      const dailyTask = cron.schedule(cronExpression, async () => {
        logger.scheduler('Running scheduled daily summaries');
        await runDailySummaries(storage);
      });
      
      scheduledTasks.push({
        id: 'daily-summaries',
        cronJob: dailyTask
      });
    }
    
    // Schedule weekly summaries if enabled
    if (settings.enableWeeklySchedule) {
      const { hours, minutes } = parseTimeString(settings.weeklyScheduleTime);
      const dayNumber = getDayNumber(settings.weeklyScheduleDay);
      
      // Create cron expression for specific day of week
      // Format: minute hour * * dayOfWeek
      const cronExpression = `${minutes} ${hours} * * ${dayNumber}`;
      
      logger.info(`Setting up weekly summary scheduler: ${cronExpression}`);
      
      const weeklyTask = cron.schedule(cronExpression, async () => {
        logger.scheduler('Running scheduled weekly summaries');
        await runWeeklySummaries(storage);
      });
      
      scheduledTasks.push({
        id: 'weekly-summaries',
        cronJob: weeklyTask
      });
    }
    
    logger.info('Summary scheduler initialized successfully');
  } catch (error) {
    logger.error('Error initializing summary scheduler', error);
  }
}

/**
 * Run daily summaries for all active projects
 * @param storage Storage interface
 */
async function runDailySummaries(storage: IStorage): Promise<void> {
  try {
    // Get all projects
    const projects = await storage.getAllProjects();
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const project of projects) {
      try {
        // Get Slack channel ID from the project's summary settings
        const settings = await storage.getProjectSummarySettings(project.id);
        const slackChannelId = settings?.slackChannelId || null;
        
        if (!slackChannelId) {
          logger.info(`Skipping daily summary for project ${project.name}: No Slack channel configured`);
          continue;
        }
        
        // Generate and send daily summary
        const result = await generateDailySummaryForProject(project.id, slackChannelId, storage);
        
        if (result.success) {
          successCount++;
          logger.info(`Daily summary for project ${project.name} completed: ${result.message}`);
        } else {
          errorCount++;
          logger.error(`Daily summary for project ${project.name} failed: ${result.message}`);
        }
      } catch (projectError) {
        errorCount++;
        logger.error(`Error processing daily summary for project ${project.name}`, projectError);
      }
    }
    
    logger.scheduler(`Daily summaries completed. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    logger.error('Error running daily summaries', error);
  }
}

/**
 * Run weekly summaries for all active projects
 * @param storage Storage interface
 */
async function runWeeklySummaries(storage: IStorage): Promise<void> {
  try {
    // Get all projects
    const projects = await storage.getAllProjects();
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const project of projects) {
      try {
        // Get Slack channel ID from the project's summary settings
        const settings = await storage.getProjectSummarySettings(project.id);
        const slackChannelId = settings?.slackChannelId || null;
        
        if (!slackChannelId) {
          logger.info(`Skipping weekly summary for project ${project.name}: No Slack channel configured`);
          continue;
        }
        
        // Generate and send weekly summary
        const result = await generateWeeklyProjectSummary(project.id, slackChannelId, storage);
        
        if (result.success) {
          successCount++;
          logger.info(`Weekly summary for project ${project.name} completed: ${result.message}`);
        } else {
          errorCount++;
          logger.error(`Weekly summary for project ${project.name} failed: ${result.message}`);
        }
      } catch (projectError) {
        errorCount++;
        logger.error(`Error processing weekly summary for project ${project.name}`, projectError);
      }
    }
    
    logger.scheduler(`Weekly summaries completed. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    logger.error('Error running weekly summaries', error);
  }
}

/**
 * Stop all running scheduled tasks
 */
export function stopAllScheduledTasks(): void {
  logger.info(`Stopping ${scheduledTasks.length} scheduled tasks`);
  
  scheduledTasks.forEach(task => {
    try {
      task.cronJob.stop();
      logger.debug(`Stopped scheduled task: ${task.id}`);
    } catch (error) {
      logger.error(`Error stopping scheduled task ${task.id}`, error);
    }
  });
  
  // Clear the tasks array
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

/**
 * Initialize the scheduler on server startup
 */
export async function initializeSchedulerOnStartup(): Promise<void> {
  try {
    // Get current settings
    const settings = await storage.getSettings();
    
    if (settings) {
      logger.info('Initializing summary scheduler on startup');
      initSummaryScheduler(settings, storage);
    } else {
      logger.warn('Could not initialize scheduler: settings not found');
    }
  } catch (error) {
    logger.error('Error initializing scheduler on startup', error);
  }
}