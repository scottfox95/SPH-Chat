import { WebClient, type ChatPostMessageArguments } from "@slack/web-api";

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN || "xoxb-placeholder");

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
