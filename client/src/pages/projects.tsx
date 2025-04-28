import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Folder, MessageSquare } from "lucide-react";
import CreateProjectForm from "@/components/dashboard/create-project-form";
import ProjectCard from "@/components/shared/project-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function Projects() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [projectChatbotCounts, setProjectChatbotCounts] = useState<Record<number, number>>({});
  const { toast } = useToast();
  
  // Fetch all projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["/api/projects"],
  });
  
  // Fetch all chatbots to calculate counts per project
  const { data: chatbots = [] } = useQuery({
    queryKey: ["/api/chatbots"],
  });
  
  // Calculate chatbot counts for each project
  useEffect(() => {
    if (chatbots.length > 0 && projects.length > 0) {
      setIsLoadingCount(true);
      
      const counts: Record<number, number> = {};
      
      // Initialize counts for all projects to 0
      projects.forEach((project: any) => {
        counts[project.id] = 0;
      });
      
      // Count chatbots for each project
      chatbots.forEach((chatbot: any) => {
        if (chatbot.projectId && counts[chatbot.projectId] !== undefined) {
          counts[chatbot.projectId]++;
        }
      });
      
      setProjectChatbotCounts(counts);
      setIsLoadingCount(false);
    }
  }, [chatbots, projects]);
  
  // Handle project deletion
  const handleDeleteProject = async (projectId: number, projectName: string) => {
    if (!window.confirm(`Are you sure you want to delete the project "${projectName}"? This will NOT delete the chatbots within this project.`)) {
      return;
    }
    
    try {
      await apiRequest('DELETE', `/api/projects/${projectId}`);
      
      toast({
        title: "Project deleted",
        description: `${projectName} has been deleted successfully.`,
      });
      
      // Refresh projects list
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast({
        title: "Deletion failed",
        description: "Failed to delete the project. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle project edit
  const handleEditProject = (projectId: number) => {
    // This would typically open an edit modal, but for simplicity
    // we'll just redirect to a dedicated edit page
    window.location.href = `/projects/${projectId}/edit`;
  };
  
  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Project Management</h1>
            <p className="text-sm text-gray-500">Organize your chatbots into logical groups</p>
          </div>
          <Button 
            onClick={() => setCreateModalOpen(true)}
            className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        {isLoadingProjects ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-[#D2B48C]" />
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: any) => (
              <ProjectCard 
                key={project.id}
                project={project}
                chatbotCount={isLoadingCount ? undefined : projectChatbotCounts[project.id] || 0}
                onDeleteClick={() => handleDeleteProject(project.id, project.name)}
                onEditClick={() => handleEditProject(project.id)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Folder className="h-10 w-10 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium">No projects found</h3>
              <p className="text-sm text-gray-500 mt-1">
                Create your first project to organize your chatbots.
              </p>
              <Button 
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 bg-[#D2B48C] hover:bg-[#D2B48C]/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Project
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
      
      {/* Create Project Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <CreateProjectForm onSuccess={() => setCreateModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}