import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card"; 
import { Trash2, PlusCircle, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsanaProjectSelector from "./asana-project-selector";

interface AsanaProject {
  id: number;
  chatbotId: number;
  asanaProjectId: string;
  projectName: string;
  projectType: string;
  createdAt: string;
}

interface AsanaProjectsManagerProps {
  chatbotId: number;
}

const projectTypeOptions = [
  { value: "main", label: "Main Project" },
  { value: "permit", label: "Permit Tracking" },
  { value: "design", label: "Design" },
  { value: "financial", label: "Financial" },
  { value: "schedule", label: "Schedule" },
];

export default function AsanaProjectsManager({ chatbotId }: AsanaProjectsManagerProps) {
  const [selectedProjectType, setSelectedProjectType] = useState("main");
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [pendingProjectName, setPendingProjectName] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch linked Asana projects - using explicit fetch to ensure proper data retrieval
  const { 
    data: projects = [], 
    isLoading,
    refetch
  } = useQuery<AsanaProject[]>({
    queryKey: [`/api/chatbots/${chatbotId}/asana-projects`],
    staleTime: 30000,
    queryFn: async () => {
      const response = await fetch(`/api/chatbots/${chatbotId}/asana-projects`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch Asana projects: ${response.status}`);
      }
      return response.json();
    }
  });
  
  // Add a new Asana project
  const addProject = async () => {
    if (!pendingProjectId || !pendingProjectName) return;
    
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/asana-projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asanaProjectId: pendingProjectId,
          projectName: pendingProjectName,
          projectType: selectedProjectType,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add Asana project");
      }
      
      // Clear pending data
      setPendingProjectId(null);
      setPendingProjectName(null);
      
      // Update the projects list
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${chatbotId}/asana-projects`] });
      
      toast({
        title: "Project added",
        description: `Added ${pendingProjectName} as a ${getProjectTypeLabel(selectedProjectType)} project`,
      });
    } catch (error) {
      toast({
        title: "Error adding project",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Remove an Asana project
  const removeProject = async (projectId: number, projectName: string) => {
    try {
      const response = await fetch(`/api/asana-projects/${projectId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove Asana project");
      }
      
      // Update the projects list
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${chatbotId}/asana-projects`] });
      
      toast({
        title: "Project removed",
        description: `Removed ${projectName} from this chatbot`,
      });
    } catch (error) {
      toast({
        title: "Error removing project",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Handle project selection from AsanaProjectSelector
  const handleProjectSelect = (projectId: string, projectName: string): void => {
    setPendingProjectId(projectId);
    setPendingProjectName(projectName);
  };
  
  // Get label for project type
  const getProjectTypeLabel = (type: string): string => {
    const option = projectTypeOptions.find(opt => opt.value === type);
    return option ? option.label : type;
  };
  
  // Get color for project type badge
  const getProjectTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case "main": return "default";
      case "permit": return "destructive";
      case "design": return "secondary";
      default: return "outline";
    }
  };
  
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Linked Asana Projects</h3>
      
      {/* Project list */}
      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-4 text-gray-500">No Asana projects linked to this chatbot</div>
      ) : (
        <div className="grid gap-2">
          {projects.map(project => (
            <Card key={project.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={getProjectTypeBadgeVariant(project.projectType)}>
                  {getProjectTypeLabel(project.projectType)}
                </Badge>
                <div>
                  <div className="text-sm font-medium">{project.projectName}</div>
                  <div className="text-xs text-gray-500">ID: {project.asanaProjectId}</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => removeProject(project.id, project.projectName)}
              >
                <Trash2 className="h-4 w-4 text-gray-500" />
              </Button>
            </Card>
          ))}
        </div>
      )}
      
      {/* Add new project section */}
      <div className="bg-gray-50 p-3 rounded-md mt-4">
        <h4 className="text-xs font-medium mb-3">Add new project</h4>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <Tag className="h-4 w-4 text-gray-500" />
            <Select value={selectedProjectType} onValueChange={setSelectedProjectType}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select project type" />
              </SelectTrigger>
              <SelectContent>
                {projectTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 items-center">
            <AsanaProjectSelector 
              onSelect={handleProjectSelect}
            />
            {pendingProjectName && (
              <div className="ml-2 flex-1">
                <div className="text-xs font-medium text-gray-700 truncate">
                  {pendingProjectName}
                </div>
                {pendingProjectId && (
                  <div className="text-xs text-gray-500 truncate">
                    ID: {pendingProjectId}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {pendingProjectId && (
            <Button 
              className="mt-2 bg-[#D2B48C] hover:bg-[#D2B48C]/90 w-full" 
              size="sm"
              onClick={addProject}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}