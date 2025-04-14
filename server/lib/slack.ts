import { WebClient, type ChatPostMessageArguments } from "@slack/web-api";

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN || "xoxb-placeholder");

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
    }
    
    return {
      valid: false,
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
  try {
    const messages = await getSlackMessages(channelId);
    
    return messages.map((msg) => {
      const date = new Date(parseFloat(msg.timestamp) * 1000);
      const formattedDate = `${date.toLocaleDateString()} @ ${date.toLocaleTimeString()}`;
      return `${msg.user} (${formattedDate}): ${msg.text}`;
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
 * Sends a message to a Slack channel
 * @param channelId The ID of the channel to send the message to
 * @param text The message text
 * @returns Response from the Slack API
 */
export async function sendSlackMessage(channelId: string, text: string) {
  try {
    const message: ChatPostMessageArguments = {
      channel: channelId,
      text,
    };
    
    const result = await slack.chat.postMessage(message);
    return result;
  } catch (error) {
    console.error("Error sending Slack message:", error);
    throw error;
  }
}

/**
 * Test connection to Slack API
 * @returns Object with connection status and details
 */
export async function testSlackConnection() {
  try {
    // Test auth.test which verifies the token
    const authTest = await slack.auth.test();
    
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
