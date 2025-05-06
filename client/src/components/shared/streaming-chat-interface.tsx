import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Paperclip, Send, Trash2 } from "lucide-react";
import { getChatMessages, clearChatMessages } from "@/lib/auth";
import { sendStreamingChatMessage } from "@/lib/streaming"; // Our new streaming implementation
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StreamingChatInterfaceProps {
  chatbotId: number;
  chatbotName: string;
  token?: string;
  initialMessages?: any[];
}

export default function StreamingChatInterface({
  chatbotId,
  chatbotName,
  token,
  initialMessages = [],
}: StreamingChatInterfaceProps) {
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const streamAbortRef = useRef<() => void>(() => {});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch messages on first load
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const fetchedMessages = await getChatMessages(chatbotId, token);
        setMessages(fetchedMessages);
      } catch (error) {
        console.error("Failed to fetch messages", error);
      }
    };
    
    fetchMessages();
  }, [chatbotId, token]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);
  
  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      streamAbortRef.current();
    };
  }, []);
  
  // Send message with streaming
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    try {
      setIsLoading(true);
      
      // Add user message to UI immediately
      const userMessage = {
        id: Date.now(),
        chatbotId,
        userId: user?.id,
        content: input,
        isUserMessage: true,
        citation: null,
        createdAt: new Date().toISOString(),
      };
      
      setMessages([...messages, userMessage]);
      setInput("");
      setStreamingMessage(""); // Reset streaming content
      
      // Start streaming and get abort function
      streamAbortRef.current = sendStreamingChatMessage(
        chatbotId,
        input,
        token,
        // On each chunk
        (content) => {
          setStreamingMessage(prev => prev + content);
        },
        // On complete
        (messageId) => {
          // When streaming is complete, add the full message to the messages array
          const botMessage = {
            id: messageId,
            chatbotId,
            userId: null,
            content: streamingMessage,
            isUserMessage: false,
            citation: null, // Could be updated if we extract citation
            createdAt: new Date().toISOString(),
          };
          
          setMessages(prev => [...prev, botMessage]);
          setStreamingMessage(""); // Clear streaming buffer
          setIsLoading(false);
        },
        // On error
        (error) => {
          console.error("Streaming error:", error);
          toast({
            title: "Error during streaming",
            description: error.message || "Please try again later",
            variant: "destructive",
          });
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error("Failed to send message", error);
      toast({
        title: "Failed to send message",
        description: "Please try again later",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };
  
  // Clear chat history
  const handleClearChat = async () => {
    try {
      setIsClearingHistory(true);
      
      const result = await clearChatMessages(chatbotId, token);
      
      if (result.success) {
        setMessages([]);
        toast({
          title: "Chat history cleared",
          description: "All previous messages have been deleted",
        });
      }
    } catch (error) {
      console.error("Failed to clear chat history", error);
      toast({
        title: "Failed to clear chat history",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsClearingHistory(false);
      setClearDialogOpen(false);
    }
  };
  
  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
      {/* Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages between you and this chatbot.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isClearingHistory}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearChat}
              disabled={isClearingHistory}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isClearingHistory ? (
                <span className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 animate-pulse" />
                  Clearing...
                </span>
              ) : (
                <span className="flex items-center">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear History
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Chat header */}
      <div className="flex justify-between items-center p-2 sm:p-3 bg-white border-b border-gray-200">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">{chatbotName}</h3>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClearDialogOpen(true)}
            disabled={isClearingHistory}
            className="text-gray-600 hover:text-red-600 border-gray-300 whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4 mr-1 sm:mr-2" /> 
            <span className="hidden xs:inline">Clear History</span>
          </Button>
        )}
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto py-3 px-2 sm:p-4 space-y-3 sm:space-y-4" style={{ scrollBehavior: "smooth" }}>
        {/* Welcome Message if no messages */}
        {messages.length === 0 && !streamingMessage && (
          <div className="flex items-start">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden mr-2 sm:mr-3 flex-shrink-0">
              <img 
                src="/SPHChat_Icon_PNG.png" 
                alt="SPH Chat" 
                className="h-full w-full object-cover"
                onError={(e) => {
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement.innerHTML = '<span class="font-bold text-xs">SPH</span>';
                  }
                }}
              />
            </div>
            <div className="flex-1">
              <div className="bg-white rounded-xl rounded-tl-sm p-3 sm:p-4 shadow-sm max-w-full sm:max-w-3xl">
                <p className="text-sm whitespace-pre-line">
                  Hello! I'm SPH ChatBot for {chatbotName}. I can answer questions about this project based on documents and Slack messages. How can I help you today?
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Message List */}
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={cn(
              "flex items-start",
              message.isUserMessage && "justify-end"
            )}
          >
            {!message.isUserMessage && (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden mr-2 sm:mr-3 flex-shrink-0">
                <img 
                  src="/SPHChat_Icon_PNG.png" 
                  alt="SPH Chat" 
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement.innerHTML = '<span class="font-bold text-xs">SPH</span>';
                    }
                  }}
                />
              </div>
            )}
            
            <div className={cn("flex-1 max-w-[85%] sm:max-w-[75%]", message.isUserMessage && "flex justify-end")}>
              <div className={cn(
                "rounded-xl p-3 sm:p-4 w-full",
                message.isUserMessage 
                  ? "bg-[#D2B48C] bg-opacity-10 rounded-tr-sm"
                  : "bg-white shadow-sm rounded-tl-sm"
              )}>
                <p className="text-sm whitespace-pre-line break-words">{message.content}</p>
                
                {/* Citation */}
                {message.citation && !message.isUserMessage && (
                  <div className="mt-2 p-2 text-xs bg-[#D2B48C] bg-opacity-15 border-l-3 border-[#D2B48C] rounded-lg">
                    <div className="font-medium text-gray-600 break-words">Source: {message.citation}</div>
                  </div>
                )}
              </div>
            </div>
            
            {message.isUserMessage && (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#A0522D] text-white flex items-center justify-center font-medium ml-2 sm:ml-3 flex-shrink-0">
                {user?.initial || "U"}
              </div>
            )}
          </div>
        ))}
        
        {/* Streaming message (appears while typing) */}
        {streamingMessage && (
          <div className="flex items-start">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden mr-2 sm:mr-3 flex-shrink-0">
              <img 
                src="/SPHChat_Icon_PNG.png" 
                alt="SPH Chat" 
                className="h-full w-full object-cover"
                onError={(e) => {
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement.innerHTML = '<span class="font-bold text-xs">SPH</span>';
                  }
                }}
              />
            </div>
            <div className="flex-1 max-w-[85%] sm:max-w-[75%]">
              <div className="bg-white rounded-xl rounded-tl-sm p-3 sm:p-4 shadow-sm w-full">
                <p className="text-sm whitespace-pre-line break-words">
                  {streamingMessage}
                  <span className="inline-block h-4 w-[2px] bg-gray-900 ml-0.5 animate-blink"></span>
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading indicator (only show when no streaming message) */}
        {isLoading && !streamingMessage && (
          <div className="flex items-start">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden mr-2 sm:mr-3 flex-shrink-0 animate-pulse">
              <img 
                src="/SPHChat_Icon_PNG.png" 
                alt="SPH Chat" 
                className="h-full w-full object-cover"
                onError={(e) => {
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement.innerHTML = '<span class="font-bold text-xs">SPH</span>';
                  }
                }}
              />
            </div>
            <div className="flex-1 max-w-[85%] sm:max-w-[75%]">
              <div className="bg-white rounded-xl rounded-tl-sm p-3 sm:p-4 shadow-sm w-full">
                <p className="text-sm whitespace-pre-line">Thinking...</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Reference for auto-scrolling */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <div className="p-2 sm:p-4 bg-white border-t border-gray-200">
        <div className="flex items-center">
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              placeholder="Ask a question..."
              className="pr-10 text-sm focus:ring-2 focus:ring-[#D2B48C]"
            />
            <button className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !input.trim()} 
            className="ml-2 bg-[#D2B48C] hover:bg-[#D2B48C]/90 p-2 sm:p-3"
            size="sm"
          >
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}