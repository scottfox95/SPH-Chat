import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, Paperclip, Send, Trash2, Zap } from "lucide-react";
import { sendChatMessage, getChatMessages, clearChatMessages } from "@/lib/auth";
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

interface ChatInterfaceProps {
  chatbotId: number;
  chatbotName: string;
  token?: string;
  initialMessages?: any[];
}

export default function ChatInterface({
  chatbotId,
  chatbotName,
  token,
  initialMessages = [],
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
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
  }, [messages]);
  
  // Send message
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
      
      // Send to server and get bot response
      const response = await sendChatMessage(chatbotId, input, token);
      
      // Add bot response to UI
      setMessages((prevMessages) => [...prevMessages, response.botMessage]);
    } catch (error) {
      console.error("Failed to send message", error);
      toast({
        title: "Failed to send message",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages between you and this chatbot.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
      <div className="flex justify-between items-center p-3 bg-white border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">{chatbotName}</h3>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClearDialogOpen(true)}
            disabled={isClearingHistory}
            className="text-gray-600 hover:text-red-600 border-gray-300"
          >
            <Trash2 className="h-4 w-4 mr-2" /> 
            Clear History
          </Button>
        )}
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollBehavior: "smooth" }}>
        {/* Welcome Message if no messages */}
        {messages.length === 0 && (
          <div className="flex items-start">
            <div className="w-8 h-8 rounded-xl overflow-hidden mr-3 flex-shrink-0">
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
              <div className="bg-white rounded-xl rounded-tl-sm p-4 shadow-sm max-w-3xl">
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
              <div className="w-8 h-8 rounded-xl overflow-hidden mr-3 flex-shrink-0">
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
            
            <div className={cn("flex-1", message.isUserMessage && "flex justify-end")}>
              <div className={cn(
                "rounded-xl p-4 max-w-3xl",
                message.isUserMessage 
                  ? "bg-[#D2B48C] bg-opacity-10 rounded-tr-sm"
                  : "bg-white shadow-sm rounded-tl-sm"
              )}>
                <p className="text-sm whitespace-pre-line">{message.content}</p>
                
                {/* Citation */}
                {message.citation && !message.isUserMessage && (
                  <div className="mt-2 p-2 text-xs bg-[#D2B48C] bg-opacity-15 border-l-3 border-[#D2B48C] rounded-lg">
                    <div className="font-medium text-gray-600">Source: {message.citation}</div>
                  </div>
                )}
              </div>
            </div>
            
            {message.isUserMessage && (
              <div className="w-8 h-8 rounded-full bg-[#A0522D] text-white flex items-center justify-center font-medium ml-3 flex-shrink-0">
                {user?.initial || "U"}
              </div>
            )}
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start">
            <div className="w-8 h-8 rounded-xl overflow-hidden mr-3 flex-shrink-0 animate-pulse">
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
              <div className="bg-white rounded-xl rounded-tl-sm p-4 shadow-sm max-w-3xl">
                <p className="text-sm whitespace-pre-line">Thinking...</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Reference for auto-scrolling */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center">
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask a question about this project..."
              className="pr-10 focus:ring-2 focus:ring-[#D2B48C]"
            />
            <button className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              <Paperclip className="h-5 w-5" />
            </button>
          </div>
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !input.trim()} 
            className="ml-2 bg-[#D2B48C] hover:bg-[#D2B48C]/90"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
