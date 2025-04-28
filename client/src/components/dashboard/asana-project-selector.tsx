import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, CheckCircle2 } from "lucide-react";

interface AsanaProject {
  id: string;
  name: string;
}

interface AsanaWorkspace {
  id: string;
  name: string;
}

interface AsanaProjectSelectorProps {
  onSelect: (projectId: string, projectName: string) => void;
  currentProjectId?: string;
}

export default function AsanaProjectSelector({ onSelect, currentProjectId }: AsanaProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<AsanaWorkspace[]>([]);
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  
  // Check Asana connection on modal open
  const handleOpen = async () => {
    setOpen(true);
    await checkAsanaConnection();
  };
  
  // Test Asana connection with explicit credentials
  const checkAsanaConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/system/test-asana", {
        method: "GET",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.connected && data.workspaces) {
        setWorkspaces(data.workspaces);
        
        // If only one workspace, auto-select it
        if (data.workspaces.length === 1) {
          setSelectedWorkspace(data.workspaces[0].id);
          await fetchProjects(data.workspaces[0].id);
        }
      } else {
        toast({
          title: "Asana connection issue",
          description: data.error || "Unable to connect to Asana. Please check your API token.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection error",
        description: "Failed to connect to Asana API. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch projects from selected workspace with explicit credentials
  const fetchProjects = async (workspaceId: string) => {
    setLoading(true);
    setProjects([]);
    try {
      const response = await fetch(`/api/system/asana-projects?workspaceId=${workspaceId}`, {
        method: "GET",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success && data.projects) {
        setProjects(data.projects);
      } else {
        toast({
          title: "Failed to fetch projects",
          description: data.error || "Could not fetch Asana projects",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "API Error",
        description: "Failed to fetch Asana projects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle workspace selection
  const handleWorkspaceSelect = async (workspaceId: string) => {
    setSelectedWorkspace(workspaceId);
    await fetchProjects(workspaceId);
  };
  
  // Handle project selection
  const handleProjectSelect = (project: AsanaProject) => {
    onSelect(project.id, project.name);
    setOpen(false);
    
    toast({
      title: "Project selected",
      description: `Selected project: ${project.name}`,
    });
  };
  
  // Filter projects by search query
  const filteredProjects = searchQuery.trim() 
    ? projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;
  
  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleOpen}
        className="text-xs"
      >
        Browse Projects
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select Asana Project</DialogTitle>
            <DialogDescription>
              Choose a project to link to this chatbot. Tasks from this project will be included in chatbot responses.
            </DialogDescription>
          </DialogHeader>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#D2B48C]" />
                <p className="mt-2 text-sm text-gray-500">Loading Asana data...</p>
              </div>
            </div>
          ) : (
            <>
              {workspaces.length > 0 ? (
                <div className="space-y-4">
                  {/* Workspace selector (only show if multiple workspaces) */}
                  {workspaces.length > 1 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Select Workspace</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {workspaces.map(workspace => (
                          <button
                            key={workspace.id}
                            className={`text-left px-4 py-2 rounded border text-sm hover:bg-gray-100 transition ${
                              selectedWorkspace === workspace.id ? 'border-[#D2B48C] bg-[#D2B48C]/10' : 'border-gray-200'
                            }`}
                            onClick={() => handleWorkspaceSelect(workspace.id)}
                          >
                            {workspace.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Project list */}
                  {selectedWorkspace && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium">Select Project</h3>
                        <div className="relative w-64">
                          <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                          <Input
                            placeholder="Search projects..."
                            className="pl-8 focus-visible:ring-[#D2B48C]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      {projects.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No projects found in this workspace
                        </div>
                      ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No projects match your search
                        </div>
                      ) : (
                        <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                          {filteredProjects.map(project => (
                            <button
                              key={project.id}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                              onClick={() => handleProjectSelect(project)}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{project.name}</span>
                                <span className="text-xs text-gray-500">ID: {project.id}</span>
                              </div>
                              {currentProjectId === project.id && (
                                <CheckCircle2 className="h-5 w-5 text-[#D2B48C]" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No Asana workspaces found. Please check your Asana API token in settings.
                </div>
              )}
            </>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}