import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Home, MessageSquare, ClipboardList, Settings, LogOut, Database, Users, FolderTree } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ReactNode, useState, useEffect } from "react";

interface Chatbot {
  id: number;
  name: string;
  slackChannelId?: string;
  publicToken?: string;
  isActive?: boolean;
}

interface SidebarLayoutProps {
  children: ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  // Get all chatbots for sidebar navigation using direct fetch
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [chatbotsLoading, setChatbotsLoading] = useState(true);
  const [chatbotsError, setChatbotsError] = useState<any>(null);
  
  // Use direct fetch instead of React Query
  useEffect(() => {
    async function fetchChatbots() {
      try {
        setChatbotsLoading(true);
        const response = await fetch('/api/chatbots', {
          credentials: 'include'
        });
        console.log("Sidebar fetch response status:", response.status);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        console.log("Sidebar chatbots fetched directly:", data);
        setChatbots(data || []);
        setChatbotsError(null);
      } catch (err) {
        console.error("Error fetching sidebar chatbots:", err);
        setChatbotsError(err);
        setChatbots([]);
      } finally {
        setChatbotsLoading(false);
      }
    }
    
    fetchChatbots();
  }, []);
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was an error logging out.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-md overflow-hidden">
              <img 
                src="/SPHChat_Icon_PNG.png" 
                alt="SPH Chat" 
                className="h-full w-full object-cover"
                onError={(e) => {
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement.innerHTML = '<span class="font-bold">SPH</span>';
                  }
                }}
              />
            </div>
            <span className="ml-2 font-semibold text-gray-900">SPH ChatBot</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Navigation</div>
          <a 
            href="/" 
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/" 
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]" 
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Home className="h-5 w-5 mr-2" />
            Dashboard
          </a>
          <a 
            href="/chatbots"
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/chatbots"
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <MessageSquare className="h-5 w-5 mr-2" />
            All Chatbots
          </a>
          <a 
            href="/summaries"
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/summaries"
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <ClipboardList className="h-5 w-5 mr-2" />
            Weekly Summaries
          </a>
          <a 
            href="/knowledge-base"
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/knowledge-base"
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Database className="h-5 w-5 mr-2" />
            Knowledge Base
          </a>
          <a 
            href="/projects"
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/projects" || location.startsWith("/projects/")
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <FolderTree className="h-5 w-5 mr-2" />
            Projects
          </a>
          <a 
            href="/settings"
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/settings"
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Settings className="h-5 w-5 mr-2" />
            Settings
          </a>
          {user?.role === "admin" && (
            <a 
              href="/users"
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
                location === "/users"
                  ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Users className="h-5 w-5 mr-2" />
              User Management
            </a>
          )}
        </nav>
        
        {/* Recent Projects (showing only last 3) */}
        {chatbots && chatbots.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Projects</div>
            <div className="space-y-2">
              {chatbots.slice(-3).map((chatbot: Chatbot) => (
                <a 
                  key={chatbot.id} 
                  href={`/chatbot/${chatbot.id}`}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
                    location === `/chatbot/${chatbot.id}`
                      ? "bg-[#D2B48C] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  {chatbot.name}
                </a>
              ))}
            </div>
          </div>
        )}
        
        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center">
            <Avatar>
              <AvatarFallback className="bg-[#A0522D] text-white">
                {user?.initial || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="ml-2">
              <div className="text-sm font-medium">{user?.displayName || "User"}</div>
              <div className="text-xs text-gray-500">{user?.role === "admin" ? "Admin" : "User"}</div>
            </div>
            <button 
              className="ml-auto text-gray-400 hover:text-gray-600"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
