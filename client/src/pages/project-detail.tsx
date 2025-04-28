import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Loader2, 
  Plus, 
  ArrowLeft, 
  Edit, 
  Trash,
  FolderOpen, 
  MessageSquare 
} from "lucide-react";
import CreateChatbotForm from "@/components/dashboard/create-chatbot-form";
import ChatbotCard from "@/components/shared/chatbot-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import ShareModal from "@/components/shared/share-modal";

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState<any>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const { toast } = useToast();
  
  const projectId = parseInt(params.id);
  
  // Fetch project details
  const { 
    data: project, 
    isLoading: isLoadingProject,
    error: projectError
  } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
  });
  
  // Fetch chatbots for this project
  const { 
    data: chatbots = [], 
    isLoading: isLoadingChatbots 
  } = useQuery({
    queryKey: [`/api/projects/${projectId}/chatbots`],
  });
  
  // Handle back button
  const handleBack = () => {
    setLocation("/projects");
  };
  
  // Handle share button on chatbot cards
  const handleShareClick = (chatbot: any) => {
    setSelectedChatbot(chatbot);
    setShareModalOpen(true);
  };
  
  // Handle project delete
  const handleDeleteProject = async () => {
    if (!project) return;
    
    if (!window.confirm(`Are you sure you want to delete the project "${project.name}"? This will NOT delete the chatbots within this project.`)) {
      return;
    }
    
    try {
      await apiRequest('DELETE', `/api/projects/${projectId}`);
      
      toast({
        title: "Project deleted",
        description: `${project.name} has been deleted successfully.`,
      });
      
      // Navigate back to projects list
      setLocation("/projects");
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast({
        title: "Deletion failed",
        description: "Failed to delete the project. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // If the project doesn't exist or there's an error
  if (projectError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-medium mb-2">Project not found</h2>
        <p className="text-gray-500 mb-4">The project you're looking for doesn't exist or you don't have permission to view it.</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }
  
  const isLoading = isLoadingProject || isLoadingChatbots;
  
  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-2 md:space-y-0">
          <div className="flex items-center">
            <Button variant="ghost" onClick={handleBack} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              {isLoadingProject ? (
                <div className="flex items-center h-7">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Loading project...</span>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-semibold flex items-center">
                    <FolderOpen className="h-5 w-5 mr-2 text-[#D2B48C]" />
                    {project?.name}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {project?.description || "No description provided"}
                  </p>
                </>
              )}
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setLocation(`/projects/${projectId}/edit`)}
              disabled={isLoading}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Project
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleDeleteProject}
              disabled={isLoading}
              className="text-red-500 border-red-200 hover:bg-red-50"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete Project
            </Button>
            
            <Button 
              onClick={() => setCreateModalOpen(true)}
              disabled={isLoading}
              className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chatbot
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium mb-2 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-[#D2B48C]" />
            Project Chatbots
          </h2>
          <p className="text-sm text-gray-500">
            {isLoading 
              ? "Loading chatbots..." 
              : `${chatbots.length} chatbot${chatbots.length !== 1 ? 's' : ''} in this project`
            }
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-[#D2B48C]" />
          </div>
        ) : chatbots.length > 0 ? (
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
              <h3 className="text-lg font-medium">No chatbots in this project</h3>
              <p className="text-sm text-gray-500 mt-1">
                Add your first chatbot to this project.
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
      </main>
      
      {/* Create Chatbot Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Chatbot in {project?.name}</DialogTitle>
          </DialogHeader>
          <CreateChatbotForm projectId={projectId.toString()} />
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