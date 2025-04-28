import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2 } from "lucide-react";
import CreateChatbotForm from "@/components/dashboard/create-chatbot-form";
import { useToast } from "@/hooks/use-toast";

export default function ProjectAddChatbot() {
  const params = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  const [createModalOpen, setCreateModalOpen] = useState(true);
  const { toast } = useToast();
  
  const projectId = params.id;
  
  // Fetch project details to display project name
  const { 
    data: project, 
    isLoading: isLoadingProject,
    error: projectError
  } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
  });
  
  // Handle modal close - navigate back to project detail
  const handleCloseModal = () => {
    setCreateModalOpen(false);
    setLocation(`/projects/${projectId}`);
  };
  
  // If project not found
  if (projectError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-medium mb-2">Project not found</h2>
        <p className="text-gray-500 mb-4">The project you're looking for doesn't exist or you don't have permission to view it.</p>
        <Button onClick={() => setLocation("/projects")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }
  
  // Show loading state while project data is loading
  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#D2B48C]" />
      </div>
    );
  }

  return (
    <Dialog open={createModalOpen} onOpenChange={handleCloseModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Chatbot to {project?.name}</DialogTitle>
        </DialogHeader>
        <CreateChatbotForm projectId={projectId} onSuccess={handleCloseModal} />
      </DialogContent>
    </Dialog>
  );
}