import { WebClient, type ChatPostMessageArguments } from "@slack/web-api";
import { convertHtmlToSlackFormat } from "./html-to-slack";

// Initialize Slack client with the token and explicitly force a new connection
// This helps ensure we're not using a cached version of the client with old permissions
const tokenToUse = process.env.SLACK_BOT_TOKEN || "xoxb-placeholder";
console.log("Initializing Slack WebClient with token starting with:", tokenToUse.substring(0, 10) + "...");

// Check if we're using a reused token by looking at the first characters
// If you update your token after adding scopes, this prefix will help confirm the change
console.log("NOTE: If your token starts with different characters after reinstalling the app, you need to update it in your environment variables");

// Create a Slack client, but allow non-fatal handling of failures
export const slack = new WebClient(tokenToUse, {
  retryConfig: {
    retries: 1,
    minTimeout: 100,
    maxTimeout: 1000
  }
});

/**
 * Validates a Slack channel ID and checks if the bot has access to it
 * @param channelId The ID of the channel to validate
 * @returns Object with validation result and channel details if successful
 */
export async function validateSlackChannel(channelId: string): Promise<{
  valid: boolean;
  name?: string;
  error?: string;
  isPrivate?: boolean;
}> {
  // Always return success if token is missing or invalid (for deployments)
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("Skipping Slack validation as no token is configured");
    return { 
      valid: true,
      name: "Unknown Channel (No Token)",
      isPrivate: false 
    };
  }

  try {
    // First try to get channel info to check if it exists and if the bot has access
    const channelInfo = await slack.conversations.info({
      channel: channelId
    });
    
    if (!channelInfo.ok || !channelInfo.channel) {
      return { 
        valid: false, 
        error: channelInfo.error || "Could not retrieve channel information" 
      };
    }
    
    return { 
      valid: true, 
      name: channelInfo.channel.name as string,
      isPrivate: channelInfo.channel.is_private as boolean
    };
  } catch (error: any) {
    console.error("Slack channel validation error:", error);
    
    // Extract specific error messages for common issues
    if (error?.data?.error === 'channel_not_found') {
      return {
        valid: false,
        error: "The channel ID does not exist or the bot does not have access to it. Make sure the bot is invited to the channel."
      };
    } else if (error?.data?.error === 'missing_scope') {
      return {
        valid: false,
        error: "The bot token is missing required permissions. Please check the Slack app configuration."
      };
    } else if (error?.data?.error === 'invalid_auth' || error?.data?.error === 'not_authed') {
      // Allow creation even with invalid auth
      console.warn("Invalid Slack authentication, but allowing chatbot creation");
      return { 
        valid: true,
        name: "Unknown Channel (Auth Failed)",
        isPrivate: false 
      };
    }
    
    // For any other errors, allow creation but log the warning
    console.warn("Unknown Slack validation error, but allowing chatbot creation:", error);
    return {
      valid: true,
      name: "Unknown Channel (Error)",
      isPrivate: false,
      error: error?.data?.error || error?.message || "Unknown error validating Slack channel"
    };
  }
}

/**
 * Fetches messages from a Slack channel
 * @param channelId The ID of the channel to fetch messages from
 * @param limit Maximum number of messages to fetch
 * @returns Array of message objects
 */
export async function getSlackMessages(channelId: string, limit = 100) {
  try {
    const result = await slack.conversations.history({
      channel: channelId,
      limit,
    });

    if (!result.ok || !result.messages) {
      throw new Error(`Failed to fetch messages: ${result.error || "Unknown error"}`);
    }

    return result.messages.map((message) => ({
      text: message.text || "",
      user: message.user || "unknown",
      timestamp: message.ts || "",
      date: new Date(parseFloat(message.ts || "0") * 1000).toISOString(),
    }));
  } catch (error) {
    console.error("Slack API error:", error);
    throw error;
  }
}

/**
 * Fetches and formats messages for the chatbot context
 * @param channelId The ID of the channel to fetch messages from
 * @returns Array of formatted message strings
 */
export async function getFormattedSlackMessages(channelId: string) {
  // If no Slack token is configured, return an empty array
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("Skipping Slack message fetching as no token is configured");
    return [];
  }
  
  try {
    const messages = await getSlackMessages(channelId);
    
    // Try to get detailed user information when available
    const userCache = new Map<string, string>();
    
    // Attempt to resolve user IDs to names
    for (const msg of messages) {
      if (msg.user && !userCache.has(msg.user) && msg.user !== 'unknown') {
        try {
          // Due to possible Slack API scope limitations, we'll try to get user info
          // but have a fallback mechanism
          try {
            console.log(`Attempting to fetch info for user ${msg.user}`);
            const userInfo = await slack.users.info({ user: msg.user });
            
            if (userInfo.ok && userInfo.user) {
              console.log(`Successfully retrieved info for user ${msg.user}`);
              const userName = userInfo.user.real_name || userInfo.user.name || msg.user;
              userCache.set(msg.user, userName);
            } else {
              console.warn(`Failed to get user info for ${msg.user} but no error was thrown`, userInfo);
              userCache.set(msg.user, "a team member");
            }
          } catch (error: any) {
            console.warn(`Error retrieving user ${msg.user} information:`, error?.data || error);
            // If we get a missing_scope error, fall back to the username from the message
            if (error && error.data && error.data.error === 'missing_scope') {
              console.warn("Missing 'users:read' scope for Slack API. Using message username as fallback.");
              // Use a generic fallback for the username since we can't access Slack profiles
              userCache.set(msg.user, "a team member");
            } else {
              console.error(`Other error getting user info: ${error?.message || 'Unknown error'}`);
              userCache.set(msg.user, "a team member");
            }
          }
        } catch (error) {
          console.warn(`Could not retrieve user info for ${msg.user}:`, error);
          userCache.set(msg.user, "a team member");
        }
      }
    }
    
    return messages.map((msg) => {
      const date = new Date(parseFloat(msg.timestamp) * 1000);
      const formattedDate = `${date.toLocaleDateString()} @ ${date.toLocaleTimeString()}`;
      const userName = userCache.get(msg.user) || msg.user;
      
      // Store detailed information in the message for attribution
      return {
        text: `${userName} (${formattedDate}): ${msg.text}`,
        meta: {
          user: userName,
          timestamp: msg.timestamp,
          formattedDate: formattedDate,
          rawMessage: msg.text
        }
      };
    });
  } catch (error) {
    console.error("Error formatting Slack messages:", error);
    return [];
  }
}

/**
 * Gets messages from the past week for summary generation
 * @param channelId The ID of the channel to fetch messages from
 * @returns Array of messages from the past week
 */
export async function getWeeklySlackMessages(channelId: string) {
  // If no Slack token is configured, return an empty array
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("Skipping weekly Slack message fetching as no token is configured");
    return [];
  }
  
  try {
    const allMessages = await getSlackMessages(channelId, 200);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return allMessages.filter((msg) => {
      const messageDate = new Date(parseFloat(msg.timestamp) * 1000);
      return messageDate >= oneWeekAgo;
    });
  } catch (error) {
    console.error("Error fetching weekly Slack messages:", error);
    return [];
  }
}

/**
 * Gets messages from the previous day for daily summary generation
 * @param channelId The ID of the channel to fetch messages from
 * @returns Array of messages from the previous day
 */
export async function getDailySlackMessages(channelId: string) {
  // If no Slack token is configured, return an empty array
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("Skipping daily Slack message fetching as no token is configured");
    return [];
  }
  
  try {
    const allMessages = await getSlackMessages(channelId, 200);
    
    // Calculate date for yesterday (previous day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allMessages.filter((msg) => {
      const messageDate = new Date(parseFloat(msg.timestamp) * 1000);
      return messageDate >= yesterday && messageDate < today;
    });
  } catch (error) {
    console.error("Error fetching daily Slack messages:", error);
    return [];
  }
}

/**
 * Gets messages from the current week up to current day for week-to-date summary generation
 * @param channelId The ID of the channel to fetch messages from
 * @returns Array of messages from the beginning of the week to current day
 */
export async function getWeekToDateSlackMessages(channelId: string) {
  // If no Slack token is configured, return an empty array
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("Skipping week-to-date Slack message fetching as no token is configured");
    return [];
  }
  
  try {
    const allMessages = await getSlackMessages(channelId, 200);
    
    // Get the current date and determine the start of the week (Monday)
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Adjust for week starting on Monday
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    return allMessages.filter((msg) => {
      const messageDate = new Date(parseFloat(msg.timestamp) * 1000);
      return messageDate >= startOfWeek;
    });
  } catch (error) {
    console.error("Error fetching week-to-date Slack messages:", error);
    return [];
  }
}

/**
 * Sends a message to a Slack channel
 * @param channelId The ID of the channel to send the message to
 * @param text The message text
 * @returns Response from the Slack API or null if sending failed
 */
export async function sendSlackMessage(channelId: string, text: string) {
  // If no Slack token is configured, return null
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("Skipping Slack message sending as no token is configured");
    return null;
  }
  
  try {
    console.log(`Attempting to send Slack message to channel ID: ${channelId}`);
    console.log(`Message text (first 100 chars): ${text.substring(0, 100)}...`);
    
    const message: ChatPostMessageArguments = {
      channel: channelId,
      text,
    };
    
    const result = await slack.chat.postMessage(message);
    console.log(`Successfully sent Slack message! Message TS: ${result.ts}, Channel: ${result.channel}`);
    return result;
  } catch (error: any) {
    console.error("Error sending Slack message:", error);
    if (error.data) {
      console.error(`Slack API error details: ${JSON.stringify(error.data)}`);
    }
    return null;
  }
}

/**
 * Type for Slack connection test result
 */
export interface SlackConnectionTestResult {
  connected: boolean;
  botName?: string;
  teamName?: string;
  url?: string;
  userId?: string;
  teamId?: string;
  error?: string;
  // Optional properties for scope testing
  hasUsersReadScope?: boolean;
  usersSample?: Array<{
    id?: string;
    name?: string;
    real_name?: string;
    is_bot?: boolean;
  }>;
  usersReadError?: string;
  usersReadErrorDetails?: {
    needed?: string;
    provided?: string;
  };
  tokenInfo?: {
    user?: string;
    team?: string;
    bot?: string;
    scopes?: string[];
    exp?: string;
  };
}

/**
 * Test connection to Slack API
 * @returns Typed object with connection status and details
 */
export async function testSlackConnection(): Promise<SlackConnectionTestResult> {
  try {
    // Test auth.test which verifies the token
    const authTest = await slack.auth.test();
    
    // Check app scopes for debugging
    try {
      // Try to access users.list to see if we have the users:read scope
      // This is a simpler way to check if we have the permission
      console.log("Testing users:read scope...");
      const result = await slack.users.list({ limit: 1 });
      console.log("users:read scope is available! Example user:", result?.members?.[0]?.name);
    } catch (scopeError: any) {
      console.warn("Error testing users:read scope:", scopeError?.data?.error || scopeError?.message || "Unknown error");
    }
    
    // If we get here, the token is valid
    return {
      connected: true,
      botName: authTest.bot_id ? `${authTest.user} (Bot)` : authTest.user,
      teamName: authTest.team,
      url: authTest.url,
      userId: authTest.user_id,
      teamId: authTest.team_id
    };
  } catch (error: any) {
    console.error("Slack connection test failed:", error);
    return {
      connected: false,
      error: error?.data?.error || error?.message || "Unknown error"
    };
  }
}

/**
 * Lists all channels the bot has access to
 * @returns Array of channel objects with id and name
 */
export async function listAccessibleChannels() {
  try {
    // List all public and private channels the bot is a member of
    const result = await slack.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 1000
    });
    
    if (!result.ok || !result.channels) {
      throw new Error(`Failed to list channels: ${result.error || "Unknown error"}`);
    }
    
    // Filter to only include channels the bot is a member of
    const accessibleChannels = result.channels
      .filter(channel => channel.is_member)
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        memberCount: channel.num_members
      }));
      
    return accessibleChannels;
  } catch (error) {
    console.error("Error listing Slack channels:", error);
    throw error;
  }
}

/**
 * Sends a formatted project summary to a Slack channel
 * @param channelId The ID of the channel to send the summary to
 * @param projectName The name of the project
 * @param summaryContent The generated summary content
 * @param chatbotCount Optional number of chatbots included in the summary
 * @returns Response from the Slack API or null if sending failed
 */
export async function sendProjectSummaryToSlack(
  channelId: string, 
  projectName: string, 
  summaryContent: string, 
  chatbotCount?: number
) {
  // If no Slack token is configured, return null
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn("Skipping Slack project summary sending as no token is configured");
    return null;
  }
  
  try {
    console.log(`Attempting to send project summary to Slack channel ID: ${channelId}`);
    console.log(`Project name: ${projectName}`);
    console.log(`Summary content length: ${summaryContent.length} chars`);
    
    // First, let's verify if the channel exists and is accessible
    try {
      // Try to get channel info to verify it exists and we can see it
      const channelInfo = await slack.conversations.info({ channel: channelId });
      console.log(`Channel info retrieved: ${channelInfo.channel?.name || 'Unknown'} (${channelId})`);
      
      // Check if the bot is a member of the channel
      if (!channelInfo.channel?.is_member) {
        console.warn(`⚠️ Bot is not a member of the channel: ${channelInfo.channel?.name || 'Unknown'} (${channelId})`);
        console.warn(`This may cause issues with sending messages. Consider using /invite @SPH_Buddy in the channel.`);
      }
    } catch (channelError: any) {
      // If we can't get channel info, log it but continue trying to send the message
      console.warn(`⚠️ Could not verify channel access for ${channelId}: ${channelError?.data?.error || channelError?.message}`);
      console.warn(`Will still attempt to send the message.`);
    }
    
    // Create a formatted message with blocks for better presentation
    const message: ChatPostMessageArguments = {
      channel: channelId,
      text: `Weekly Summary for ${projectName}`, // Fallback text
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📊 Weekly Summary: ${projectName}`,
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `This summary includes activity from ${chatbotCount || 'multiple'} chatbot${chatbotCount === 1 ? '' : 's'} within this project.`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: convertHtmlToSlackFormat(summaryContent).substring(0, 3000) // Convert HTML to Slack format and limit to 3000 chars
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Generated on ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    };
    
    console.log(`Sending message to Slack with channel: ${channelId}`);
    const result = await slack.chat.postMessage(message);
    console.log(`Successfully sent project summary to Slack! Message TS: ${result.ts}, Channel: ${result.channel}`);
    return result;
  } catch (error: any) {
    console.error("Error sending project summary to Slack:", error);
    
    // Provide more detailed error messages based on error type
    if (error.data) {
      const errorCode = error.data.error;
      console.error(`Slack API error details: ${JSON.stringify(error.data)}`);
      
      // Handle specific error cases with helpful messages
      if (errorCode === 'channel_not_found') {
        console.error(`Channel ${channelId} not found. Make sure the channel ID is correct.`);
      } else if (errorCode === 'not_in_channel') {
        console.error(`Bot is not in channel ${channelId}. Please invite the bot to the channel using /invite @SPH_Buddy.`);
      } else if (errorCode === 'invalid_auth') {
        console.error('Invalid authentication token. Please check your Slack bot token.');
      } else if (errorCode === 'channel_is_archived') {
        console.error(`Channel ${channelId} is archived and cannot receive messages.`);
      } else if (errorCode === 'missing_scope') {
        console.error(`Missing required OAuth scope: ${error.data.needed}. Current scopes: ${error.data.provided}.`);
      }
    }
    
    return null;
  }
}
