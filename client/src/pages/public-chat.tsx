import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { validateChatbotToken } from "@/lib/auth";
import ChatInterface from "@/components/shared/chat-interface";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Bell } from "lucide-react";

export default function PublicChat() {
  const { token } = useParams();
  const [chatbotId, setChatbotId] = useState<number | null>(null);
  const [chatbotName, setChatbotName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const validateToken = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/public/chatbot/${token}`);
        
        if (!response.ok) {
          throw new Error("Invalid chatbot token");
        }
        
        const data = await response.json();
        setChatbotId(data.id);
        setChatbotName(data.name);
      } catch (error) {
        console.error("Token validation error:", error);
        toast({
          title: "Access Error",
          description: "This chatbot link is invalid or has expired.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      validateToken();
    }
  }, [token, toast]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-[#D2B48C] flex items-center justify-center mb-4">
          <span className="text-white font-semibold">SPH</span>
        </div>
        <h1 className="text-xl font-semibold mb-2">SPH ChatBot</h1>
        <div className="animate-spin h-6 w-6 border-2 border-[#D2B48C] border-t-transparent rounded-full"></div>
        <p className="mt-2 text-gray-500">Loading chatbot...</p>
      </div>
    );
  }

  if (!chatbotId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-xl bg-[#D2B48C] flex items-center justify-center mb-4">
          <span className="text-white font-semibold">SPH</span>
        </div>
        <h1 className="text-xl font-semibold mb-2">SPH ChatBot</h1>
        <p className="text-gray-800 text-center max-w-md">
          The chatbot link you're trying to access is invalid or has expired.
        </p>
        <p className="text-gray-500 text-center mt-2 text-sm">
          Please contact your project manager for a valid link.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-xl bg-[#D2B48C] flex items-center justify-center">
            <span className="text-white font-semibold">SPH</span>
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-semibold">{chatbotName}</h1>
            <p className="text-xs text-gray-500">SPH ChatBot Assistant</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto text-gray-600"
          onClick={handleCopyLink}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </>
          )}
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ChatInterface
          chatbotId={chatbotId}
          chatbotName={chatbotName}
          token={token}
        />
      </div>

      <footer className="bg-white border-t border-gray-200 p-3 text-center text-xs text-gray-500">
        Powered by SPH ChatBot · AI Assistant for Construction Projects
      </footer>
    </div>
  );
}
