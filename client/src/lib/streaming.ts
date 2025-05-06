/**
 * Helper functions for working with the streaming API
 */

/**
 * Sends a chat message to a chatbot with server-sent events streaming
 * @param chatbotId The ID of the chatbot
 * @param message The message to send
 * @param token Optional token for public access
 * @param onChunk Callback for each chunk of the response
 * @param onComplete Callback when streaming is complete
 * @param onError Callback when an error occurs
 * @returns A function that can be called to abort the stream
 */
export function sendStreamingChatMessage(
  chatbotId: number,
  message: string,
  token: string | undefined,
  onChunk: (content: string) => void,
  onComplete: (messageId: string) => void,
  onError: (error: Error) => void
): () => void {
  try {
    // Prepare the request
    const controller = new AbortController();
    const signal = controller.signal;

    // Start the stream
    fetch(`/api/chatbots/${chatbotId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, token }),
      signal
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      // Set up stream reader
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Process the stream
      function processStream() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // Handle any remaining data in the buffer
            if (buffer.length > 0) {
              try {
                processBufferEvents();
              } catch (e) {
                console.error('Error processing final buffer:', e);
              }
            }
            return;
          }

          // Add the new chunk to our buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete events in the buffer
          processBufferEvents();
          
          // Continue reading
          return processStream();
        });
      }

      // Process buffer for complete SSE events
      function processBufferEvents() {
        let eventStart = 0;
        let eventEnd = buffer.indexOf('\n\n');
        
        while (eventEnd !== -1) {
          const eventData = buffer.slice(eventStart, eventEnd);
          eventStart = eventEnd + 2; // Move past the \n\n
          
          if (eventData.startsWith('data:')) {
            const jsonData = eventData.slice(5); // Remove 'data:' prefix
            try {
              const data = JSON.parse(jsonData);
              
              if (data.content) {
                onChunk(data.content);
              }
              
              if (data.done && data.messageId) {
                onComplete(data.messageId);
              }
              
              if (data.error) {
                onError(new Error(data.error));
              }
            } catch (e) {
              console.error(`Error parsing event data:`, e);
            }
          }
          
          // Find the next event
          eventEnd = buffer.indexOf('\n\n', eventStart);
        }
        
        // Keep the remainder of the buffer
        buffer = buffer.slice(eventStart);
      }

      // Start processing the stream
      return processStream();
    }).catch(error => {
      onError(error);
    });

    // Return abort function
    return () => controller.abort();
  } catch (error) {
    onError(error as Error);
    return () => {}; // Empty abort function if we failed to start
  }
}