import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Database, RefreshCw } from "lucide-react";

interface AsanaProject {
  id: string;
  name: string;
}

interface AsanaWorkspace {
  id: string;
  name: string;
}

export default function AsanaProjectsList() {
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<AsanaWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectCount, setProjectCount] = useState(0);
  const { toast } = useToast();

  // Load Asana workspaces on component mount
  useEffect(() => {
    checkAsanaConnection();
  }, []);

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
  
  // Fetch all projects from selected workspace
  const fetchProjects = async (workspaceId: string) => {
    setLoading(true);
    setProjects([]);
    try {
      const response = await fetch(`/api/system/all-asana-projects?workspaceId=${workspaceId}`, {
        method: "GET",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success && data.projects) {
        setProjects(data.projects);
        setProjectCount(data.projectCount || data.projects.length);
        
        toast({
          title: "Projects loaded",
          description: `Loaded ${data.projectCount || data.projects.length} Asana projects`
        });
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
  
  // Filter projects by search query
  const filteredProjects = searchQuery.trim() 
    ? projects.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.includes(searchQuery)
      )
    : projects;
  
  // Copy project ID to clipboard
  const copyProjectId = (id: string) => {
    navigator.clipboard.writeText(id)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: `Project ID: ${id}`
        });
      })
      .catch(err => {
        toast({
          title: "Failed to copy",
          description: "Please copy the ID manually",
          variant: "destructive"
        });
      });
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-white border-b border-gray-100">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-[#D2B48C]" />
            Asana Projects Directory
          </div>
          {projects.length > 0 && (
            <span className="text-xs font-normal text-gray-500">
              {projectCount} total projects
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Browse all available Asana projects across workspaces
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
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
              <div className="p-4 space-y-4">
                {/* Workspace selector */}
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
                
                {/* Project list */}
                {selectedWorkspace && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">Projects List</h3>
                      <div className="relative w-64">
                        <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                        <Input
                          placeholder="Search by name or ID..."
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
                      <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                        {filteredProjects.map(project => (
                          <div
                            key={project.id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{project.name}</span>
                              <span className="text-xs text-gray-500 cursor-pointer" onClick={() => copyProjectId(project.id)}>
                                ID: {project.id} (click to copy)
                              </span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-2"
                              onClick={() => copyProjectId(project.id)}
                            >
                              Copy ID
                            </Button>
                          </div>
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
      </CardContent>
      
      <CardFooter className="bg-gray-50 border-t border-gray-100 p-3 flex justify-between">
        <p className="text-xs text-gray-500">
          {filteredProjects.length > 0 ? (
            `Showing ${filteredProjects.length} of ${projects.length} projects`
          ) : (
            "Connect to a workspace to view projects"
          )}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8"
          onClick={checkAsanaConnection}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Refreshing
            </>
          ) : (
            <>
              <RefreshCw className="mr-1 h-3 w-3" />
              Refresh
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}