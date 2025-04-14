import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MessageSquare, FileText, Mail } from "lucide-react";
import CreateChatbotForm from "@/components/dashboard/create-chatbot-form";
import ChatbotCard from "@/components/shared/chatbot-card";
import ShareModal from "@/components/shared/share-modal";

export default function Dashboard() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState<any>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  
  // Fetch chatbots
  const { data: chatbots = [] } = useQuery({
    queryKey: ["/api/chatbots"],
  });
  
  const handleShareClick = (chatbot: any) => {
    setSelectedChatbot(chatbot);
    setShareModalOpen(true);
  };
  
  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-gray-500">Manage your HomeBuildBot assistants</p>
          </div>
          <Button 
            onClick={() => setCreateModalOpen(true)}
            className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chatbot
          </Button>
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
                <span className="text-2xl font-bold">
                  {chatbots.filter((bot: any) => bot.isActive).length}
                </span>
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
                <span className="text-2xl font-bold">--</span>
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
                <span className="text-2xl font-bold">--</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="active" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="active" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                Active Projects
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                All Projects
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="active" className="space-y-4">
            {chatbots.filter((bot: any) => bot.isActive).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chatbots
                  .filter((bot: any) => bot.isActive)
                  .map((chatbot: any) => (
                    <ChatbotCard 
                      key={chatbot.id} 
                      chatbot={chatbot} 
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
                    Start by creating a new HomeBuildBot for your project.
                  </p>
                  <Button 
                    onClick={() => setCreateModalOpen(true)}
                    className="mt-4 bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Chatbot
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="all" className="space-y-4">
            {chatbots.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chatbots.map((chatbot: any) => (
                  <ChatbotCard 
                    key={chatbot.id} 
                    chatbot={chatbot} 
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
                    Create your first HomeBuildBot to get started.
                  </p>
                  <Button 
                    onClick={() => setCreateModalOpen(true)}
                    className="mt-4 bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Chatbot
                  </Button>
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
            <DialogTitle>Create New HomeBuildBot</DialogTitle>
          </DialogHeader>
          <CreateChatbotForm />
        </DialogContent>
      </Dialog>
      
      {/* Share Modal */}
      {selectedChatbot && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          chatbot={selectedChatbot}
        />
      )}
    </>
  );
}
