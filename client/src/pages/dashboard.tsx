import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MessageSquare, FileText, Mail, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import CreateChatbotForm from "@/components/dashboard/create-chatbot-form";
import ChatbotCard from "@/components/shared/chatbot-card";
import ShareModal from "@/components/shared/share-modal";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState<Chatbot | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Direct state for counts to avoid any React Query caching issues
  const [chatbotCount, setChatbotCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [summaryCount, setSummaryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch data directly instead of using React Query's cache
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch chatbots
        const chatbotsResponse = await fetch('/api/chatbots');
        const chatbotsData = await chatbotsResponse.json();
        
        if (Array.isArray(chatbotsData)) {
          const activeChatbots = chatbotsData.filter(bot => bot.isActive);
          setChatbotCount(activeChatbots.length);
        }
        
        // Fetch documents
        const documentsResponse = await fetch('/api/documents');
        const documentsData = await documentsResponse.json();
        
        if (Array.isArray(documentsData)) {
          setDocumentCount(documentsData.length);
        }
        
        // Check if summaries endpoint exists, otherwise default to 0
        try {
          const summariesResponse = await fetch('/api/summaries');
          if (summariesResponse.ok) {
            const summariesData = await summariesResponse.json();
            if (Array.isArray(summariesData)) {
              setSummaryCount(summariesData.length);
            }
          }
        } catch (error) {
          console.error("Error fetching summaries:", error);
          setSummaryCount(0);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Define the type for chatbots from API
  interface Chatbot {
    id: number;
    name: string;
    isActive: boolean;
    publicToken: string;
    requireAuth: boolean;
    createdAt: string;
    slackChannelId: string | null;
    asanaProjectId: string | null;
    asanaConnectionId: string | null;
    createdById: number;
    projectId: number | null;
    project?: {
      id: number;
      name: string;
    } | null;
  }
  
  // Define the type expected by ChatbotCard
  interface ChatbotCardType {
    id: number;
    name: string;
    isActive: boolean;
    publicToken: string;
    slackChannelId: string;
    createdAt: string;
    projectId?: number | null;
    project?: {
      id: number;
      name: string;
    } | null;
  }
  
  // Fetch chatbots for the cards display
  const { data: chatbots = [] as Chatbot[] } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });
  
  // Function to safely transform Chatbot to ChatbotCardType
  const transformChatbot = (chatbot: Chatbot): ChatbotCardType => {
    return {
      ...chatbot,
      slackChannelId: chatbot.slackChannelId || 'Not Set' // Ensure slackChannelId is never null
    };
  };

  const handleShareClick = (chatbot: Chatbot) => {
    setSelectedChatbot(chatbot);
    setShareModalOpen(true);
  };
  
  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-gray-500">Manage your SPH ChatBot assistants</p>
          </div>
          {isAdmin && (
            <Button 
              onClick={() => setCreateModalOpen(true)}
              className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chatbot
            </Button>
          )}
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Active Chatbots</CardTitle>
              <CardDescription>Total project assistants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <MessageSquare className="h-5 w-5 text-[#D2B48C] mr-2" />
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold">{chatbotCount}</span>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Documents</CardTitle>
              <CardDescription>Total uploaded files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-[#D2B48C] mr-2" />
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold">{documentCount}</span>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Summaries</CardTitle>
              <CardDescription>Weekly reports sent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Mail className="h-5 w-5 text-[#D2B48C] mr-2" />
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold">{summaryCount}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="active" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="active" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                Active Projects
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                All Projects
              </TabsTrigger>
            </TabsList>
            
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search chatbots by name..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <TabsContent value="active" className="space-y-4">
            {chatbots && chatbots.filter((bot: Chatbot) => 
              bot.isActive && 
              bot.name.toLowerCase().includes(searchQuery.toLowerCase())
            ).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chatbots
                  .filter((bot: Chatbot) => 
                    bot.isActive && 
                    bot.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((chatbot: Chatbot) => (
                    <ChatbotCard 
                      key={chatbot.id} 
                      chatbot={transformChatbot(chatbot)} 
                      onShare={() => handleShareClick(chatbot)}
                    />
                  ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <MessageSquare className="h-10 w-10 text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium">No active projects</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {isAdmin 
                      ? "Start by creating a new SPH ChatBot for your project."
                      : "No active projects are available for you at this time."}
                  </p>
                  {isAdmin && (
                    <Button 
                      onClick={() => setCreateModalOpen(true)}
                      className="mt-4 bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Chatbot
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="all" className="space-y-4">
            {chatbots && chatbots.filter((bot: Chatbot) => 
              bot.name.toLowerCase().includes(searchQuery.toLowerCase())
            ).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chatbots
                  .filter((bot: Chatbot) => 
                    bot.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((chatbot: Chatbot) => (
                    <ChatbotCard 
                      key={chatbot.id} 
                      chatbot={transformChatbot(chatbot)} 
                      onShare={() => handleShareClick(chatbot)}
                    />
                  ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <MessageSquare className="h-10 w-10 text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium">No projects found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {isAdmin 
                      ? "Create your first SPH ChatBot to get started."
                      : "No projects are available for you at this time."}
                  </p>
                  {isAdmin && (
                    <Button 
                      onClick={() => setCreateModalOpen(true)}
                      className="mt-4 bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Chatbot
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Create Chatbot Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New SPH ChatBot</DialogTitle>
          </DialogHeader>
          <CreateChatbotForm />
        </DialogContent>
      </Dialog>
      
      {/* Share Modal */}
      {selectedChatbot && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          chatbot={transformChatbot(selectedChatbot)}
        />
      )}
    </>
  );
}
