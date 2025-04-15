import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Home, MessageSquare, ClipboardList, Settings, LogOut, Database } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  // Get all chatbots for sidebar navigation
  const { data: chatbots = [] } = useQuery({
    queryKey: ["/api/chatbots"],
  });
  
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
            <img 
              src="/images/sph-chat-logo.png" 
              alt="SPH Chat Logo" 
              className="w-8 h-8 rounded-md"
            />
            <span className="ml-2 font-semibold text-gray-900">SPH ChatBot</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Navigation</div>
          <Link href="/">
            <a className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/" 
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]" 
                : "text-gray-600 hover:bg-gray-100"
            )}>
              <Home className="h-5 w-5 mr-2" />
              Dashboard
            </a>
          </Link>
          <Link href="/chatbots">
            <a className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/chatbots"
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}>
              <MessageSquare className="h-5 w-5 mr-2" />
              All Chatbots
            </a>
          </Link>
          <Link href="/summaries">
            <a className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/summaries"
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}>
              <ClipboardList className="h-5 w-5 mr-2" />
              Weekly Summaries
            </a>
          </Link>
          <Link href="/knowledge-base">
            <a className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/knowledge-base"
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}>
              <Database className="h-5 w-5 mr-2" />
              Knowledge Base
            </a>
          </Link>
          <Link href="/settings">
            <a className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
              location === "/settings"
                ? "bg-[#D2B48C] bg-opacity-10 text-[#D2B48C]"
                : "text-gray-600 hover:bg-gray-100"
            )}>
              <Settings className="h-5 w-5 mr-2" />
              Settings
            </a>
          </Link>
        </nav>
        
        {/* Active Projects */}
        {chatbots && chatbots.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Projects</div>
            <div className="space-y-2">
              {chatbots.map((chatbot: any) => (
                <Link key={chatbot.id} href={`/chatbot/${chatbot.id}`}>
                  <a className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-xl",
                    location === `/chatbot/${chatbot.id}`
                      ? "bg-[#D2B48C] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}>
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    {chatbot.name}
                  </a>
                </Link>
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
