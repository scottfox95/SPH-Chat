import { useState } from "react";
import ChatInterface from "@/components/shared/chat-interface";
import StreamingChatInterface from "@/components/shared/streaming-chat-interface";
import { Button } from "@/components/ui/button";

export default function StreamingDemoPage() {
  const [useStreaming, setUseStreaming] = useState(true);
  
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 rounded-xl bg-[#D2B48C] flex items-center justify-center">
            <span className="text-white font-semibold text-sm">SPH</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold">SPH Chat Streaming Demo</h1>
            <p className="text-xs text-gray-500">Compare Regular vs True Token Streaming</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Mode:</span>
          <Button
            variant={useStreaming ? "outline" : "default"}
            size="sm"
            onClick={() => setUseStreaming(false)}
            className="text-xs"
          >
            Regular
          </Button>
          <Button
            variant={useStreaming ? "default" : "outline"}
            size="sm"
            onClick={() => setUseStreaming(true)}
            className="text-xs"
          >
            Streaming
          </Button>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        {useStreaming ? (
          <StreamingChatInterface 
            chatbotId={30} // Use a known chatbot ID for demo
            chatbotName="Test Chatbot"
            token="public-token" // Add a test token
          />
        ) : (
          <ChatInterface 
            chatbotId={30} // Use a known chatbot ID for demo
            chatbotName="Test Chatbot"
            token="public-token" // Add a test token
          />
        )}
      </div>
      
      <footer className="bg-white border-t border-gray-200 p-2 text-center text-xs text-gray-500">
        This demo shows the difference between traditional simulated streaming and true token-by-token streaming.
      </footer>
    </div>
  );
}