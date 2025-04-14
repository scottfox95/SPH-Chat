import { apiRequest } from "./queryClient";

/**
 * Validates a chatbot token
 * @param token The token to validate
 * @returns The chatbot ID if valid, null otherwise
 */
export async function validateChatbotToken(token: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/public/chatbot/${token}`);
    
    if (!res.ok) {
      return null;
    }
    
    const data = await res.json();
    return data.id;
  } catch (error) {
    console.error("Error validating token:", error);
    return null;
  }
}

/**
 * Sends a chat message to a chatbot
 * @param chatbotId The ID of the chatbot
 * @param message The message to send
 * @param token Optional token for public access
 * @returns The response from the chatbot
 */
export async function sendChatMessage(
  chatbotId: number,
  message: string,
  token?: string
) {
  try {
    const res = await apiRequest("POST", `/api/chatbots/${chatbotId}/chat`, {
      message,
      token,
    });
    
    return await res.json();
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

/**
 * Gets chat messages for a chatbot
 * @param chatbotId The ID of the chatbot
 * @param token Optional token for public access
 * @returns The chat messages
 */
export async function getChatMessages(chatbotId: number, token?: string) {
  try {
    const queryParams = token ? `?token=${token}` : "";
    const res = await fetch(`/api/chatbots/${chatbotId}/messages${queryParams}`);
    
    if (!res.ok) {
      throw new Error(`Failed to fetch messages: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
}
