import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, Bell, Settings, FileUp, Trash2, Pencil, FolderOpen, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import EditableTitle from "@/components/shared/editable-title";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ChatInterface from "@/components/shared/chat-interface";
import ShareModal from "@/components/shared/share-modal";
import UploadDocuments from "@/components/dashboard/upload-documents";
import AsanaProjectSelector from "@/components/dashboard/asana-project-selector";
import AsanaProjectsManager from "@/components/dashboard/asana-projects-manager";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ChatbotProps {
  id: number;
}

// ProjectSelector component
function ProjectSelector({ chatbotId, currentProjectId }: { chatbotId: number, currentProjectId: number | null }) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Fetch projects for the dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });
  
  console.log(`ProjectSelector render - chatbotId: ${chatbotId}, currentProjectId: ${currentProjectId}`);
  
  // Update project assignment mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (projectId: string | null) => {
      // Convert string projectId to number or null
      let numericProjectId: number | null = null;
      if (projectId !== null && projectId !== "none") {
        numericProjectId = parseInt(projectId, 10);
      }
      
      const res = await apiRequest("PUT", `/api/chatbots/${chatbotId}`, {
        projectId: numericProjectId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Find project name for better messaging
      const projectName = data.projectId 
        ? projects.find((p: any) => p.id === data.projectId)?.name || "selected project"
        : null;
        
      toast({
        title: "Project assignment updated",
        description: projectName 
          ? `Chatbot has been assigned to the "${projectName}" project.` 
          : "Chatbot has been removed from project assignment.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${chatbotId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${data.projectId}/chatbots`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update project assignment",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleProjectChange = async (value: string) => {
    console.log(`handleProjectChange - value: ${value}`);
    try {
      setIsUpdating(true);
      
      // Convert string projectId to number or null
      let numericProjectId: number | null = null;
      if (value !== "none") {
        numericProjectId = parseInt(value, 10);
      }
      
      console.log(`Making PUT request to /api/chatbots/${chatbotId} with projectId:`, numericProjectId);
      
      // Make the API call directly instead of using mutation
      const response = await fetch(`/api/chatbots/${chatbotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ projectId: numericProjectId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Project update success:', data);
      
      // Find project name for better messaging
      const projectName = data.projectId 
        ? projects.find((p: any) => p.id === data.projectId)?.name || "selected project"
        : null;
      
      toast({
        title: "Project assignment updated",
        description: projectName 
          ? `Chatbot has been assigned to the "${projectName}" project.` 
          : "Chatbot has been removed from project assignment.",
      });
      
      // Invalidate queries manually
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${chatbotId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${data.projectId}/chatbots`] });
      }
      
      // Reload the page to ensure state is reset properly
      window.location.reload();
      
    } catch (error) {
      console.error('Project update error:', error);
      toast({
        title: "Failed to update project assignment",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Convert current project ID to string for the select component
  const currentProjectValue = currentProjectId ? currentProjectId.toString() : "none";
  
  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <Select 
          value={currentProjectValue}
          onValueChange={handleProjectChange}
          disabled={isUpdating}
        >
          <SelectTrigger className="focus-visible:ring-[#D2B48C]">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-gray-400" />
                None
              </span>
            </SelectItem>
            {projects.map((project: any) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                <span className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-[#D2B48C]" />
                  {project.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function Chatbot({ id }: ChatbotProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [asanaProjectId, setAsanaProjectId] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Fetch chatbot data with direct fetch instead of React Query
  const [chatbot, setChatbot] = useState<any>(null);
  const [chatbotLoading, setChatbotLoading] = useState(true);
  const [chatbotError, setChatbotError] = useState<any>(null);
  
  // Fetch chatbot directly
  useEffect(() => {
    async function fetchChatbot() {
      try {
        setChatbotLoading(true);
        const response = await fetch(`/api/chatbots/${id}`, {
          credentials: 'include'
        });
        console.log(`Fetch chatbot ${id} status:`, response.status);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        console.log(`Chatbot ${id} fetched directly:`, data);
        setChatbot(data);
        setChatbotError(null);
      } catch (err) {
        console.error(`Error fetching chatbot ${id}:`, err);
        setChatbotError(err);
        setChatbot(null);
      } finally {
        setChatbotLoading(false);
      }
    }
    
    fetchChatbot();
  }, [id]);
  
  // Set Asana project ID when data loads
  useEffect(() => {
    if (chatbot && chatbot.asanaProjectId) {
      setAsanaProjectId(chatbot.asanaProjectId);
    }
  }, [chatbot]);

  // Fetch documents - explicit fetch implementation to ensure documents load correctly
  const { data: documents = [], isLoading: documentsLoading } = useQuery<any[]>({
    queryKey: [`/api/chatbots/${id}/documents`],
    queryFn: async () => {
      const response = await fetch(`/api/chatbots/${id}/documents`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status}`);
      }
      return response.json();
    }
  });

  // Fetch email recipients - using same explicit fetch pattern for consistency
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery<any[]>({
    queryKey: [`/api/chatbots/${id}/recipients`],
    queryFn: async () => {
      const response = await fetch(`/api/chatbots/${id}/recipients`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch recipients: ${response.status}`);
      }
      return response.json();
    }
  });

  // Add email recipient mutation
  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", `/api/chatbots/${id}/recipients`, {
        email,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Email added",
        description: "Recipient has been added to the summary distribution list.",
      });
      setNewEmail("");
      setEmailModalOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${id}/recipients`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add email",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await apiRequest("DELETE", `/api/documents/${docId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "The document has been removed from this chatbot.",
      });
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${id}/documents`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete document",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete email recipient mutation
  const deleteRecipientMutation = useMutation({
    mutationFn: async (recipientId: number) => {
      const res = await apiRequest("DELETE", `/api/recipients/${recipientId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Email removed",
        description: "Recipient has been removed from the summary distribution list.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${id}/recipients`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove email",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const res = await apiRequest("PUT", `/api/chatbots/${id}`, {
        isActive,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.isActive ? "Chatbot activated" : "Chatbot deactivated",
        description: `${data.name} is now ${data.isActive ? "active" : "inactive"}.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update chatbot name mutation
  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("PUT", `/api/chatbots/${id}`, {
        name,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Chatbot renamed",
        description: `Chatbot has been renamed to ${data.name}.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to rename chatbot",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/chatbots/${id}/generate-summary`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Summary generated",
        description: "Weekly summary has been generated and sent to recipients.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate summary",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Update Asana project ID mutation
  const updateAsanaProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await apiRequest("PUT", `/api/chatbots/${id}`, {
        asanaProjectId: projectId || null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Asana project updated",
        description: data.asanaProjectId 
          ? "Chatbot is now linked to the Asana project." 
          : "Chatbot has been unlinked from Asana project.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update Asana project",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Update system prompt mutation
  const updateSystemPromptMutation = useMutation({
    mutationFn: async (systemPrompt: string) => {
      const res = await apiRequest("PUT", `/api/chatbots/${id}`, {
        systemPrompt: systemPrompt || null, // Convert empty string to null
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "System prompt updated",
        description: data.systemPrompt
          ? "Chatbot now uses a custom system prompt."
          : "Chatbot now uses the app-wide system prompt.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update system prompt",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Update output format mutation
  const updateOutputFormatMutation = useMutation({
    mutationFn: async (outputFormat: string) => {
      const res = await apiRequest("PUT", `/api/chatbots/${id}`, {
        outputFormat: outputFormat || null, // Convert empty string to null
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Output format updated",
        description: data.outputFormat
          ? "Chatbot now uses a custom output format."
          : "Chatbot now uses free-form responses.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update output format",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail) {
      addEmailMutation.mutate(newEmail);
    }
  };

  const handleDeleteDocument = (docId: number) => {
    deleteDocumentMutation.mutate(docId);
  };

  const handleDeleteRecipient = (recipientId: number) => {
    deleteRecipientMutation.mutate(recipientId);
  };

  const handleToggleActive = (isActive: boolean) => {
    toggleActiveMutation.mutate(isActive);
  };

  const handleGenerateSummary = () => {
    generateSummaryMutation.mutate();
  };
  
  const handleUpdateAsanaProject = () => {
    updateAsanaProjectMutation.mutate(asanaProjectId);
  };
  
  const handleAsanaProjectSelect = (projectId: string) => {
    setAsanaProjectId(projectId);
    updateAsanaProjectMutation.mutate(projectId);
  };

  if (chatbotLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#D2B48C] border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4">Loading chatbot...</p>
        </div>
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">Chatbot not found</p>
          <p className="text-gray-500">The chatbot you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 py-2 sm:py-4 px-3 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold truncate max-w-[250px] sm:max-w-md">{chatbot.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const newName = prompt("Enter new chatbot name:", chatbot.name);
                if (newName && newName !== chatbot.name) {
                  updateNameMutation.mutate(newName);
                }
              }}
              className="h-6 w-6 sm:h-7 sm:w-7 hover:bg-gray-100"
            >
              <Pencil className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">SPH ChatBot Assistant</p>
        </div>
        <div className="flex items-center gap-2 sm:space-x-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleGenerateSummary()}
            disabled={generateSummaryMutation.isPending}
            className="text-xs sm:text-sm px-2 sm:px-3"
          >
            <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Generate Summary</span>
            <span className="xs:hidden">Summary</span>
          </Button>
          <Button 
            onClick={() => setShareModalOpen(true)}
            className="bg-[#D2B48C] hover:bg-[#D2B48C]/90 text-xs sm:text-sm px-2 sm:px-3"
            size="sm"
          >
            <Share2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Share
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface
            chatbotId={chatbot.id}
            chatbotName={chatbot.name}
          />
        </div>
        
        {isAdmin && (
          <div className="md:w-80 border-t md:border-t-0 md:border-l border-gray-200 bg-white overflow-y-auto">
            <Tabs defaultValue="settings" className="p-3 sm:p-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="settings" className="text-xs sm:text-sm data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                  Settings
                </TabsTrigger>
                <TabsTrigger value="documents" className="text-xs sm:text-sm data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                  Documents
                </TabsTrigger>
                <TabsTrigger value="emails" className="text-xs sm:text-sm data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                  Emails
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="settings" className="pt-4 space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="chatbot-name">Chatbot Name</Label>
                    <div className="flex items-center justify-between mt-1 border rounded p-2 hover:bg-gray-50">
                      <div className="font-medium text-sm">{chatbot.name}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newName = prompt("Enter new chatbot name:", chatbot.name);
                          if (newName && newName !== chatbot.name) {
                            updateNameMutation.mutate(newName);
                          }
                        }}
                        className="text-xs"
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="active-status">Active Status</Label>
                      <p className="text-xs text-gray-500">Enable or disable this chatbot</p>
                    </div>
                    <Switch
                      id="active-status"
                      checked={chatbot.isActive}
                      onCheckedChange={handleToggleActive}
                      className="data-[state=checked]:bg-[#D2B48C]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="slack-channel">Slack Channel ID</Label>
                    <Input
                      id="slack-channel"
                      value={chatbot.slackChannelId}
                      readOnly
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="asana-projects">Asana Projects</Label>
                    <div className="mt-2">
                      <AsanaProjectsManager chatbotId={chatbot.id} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Link this chatbot to multiple Asana projects with different project types
                    </p>
                    
                    {/* Legacy Single Project Support */}
                    {chatbot.asanaProjectId && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs font-medium text-gray-700">Legacy Project ID</p>
                        <div className="text-xs text-gray-500 mt-1">
                          This chatbot is also linked to a legacy single project: {chatbot.asanaProjectId}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="public-token">Public Token</Label>
                    <div className="flex items-center mt-1">
                      <Input
                        id="public-token"
                        value={chatbot.publicToken}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="project-assignment">Project Assignment</Label>
                    <ProjectSelector chatbotId={chatbot.id} currentProjectId={chatbot.projectId} />
                    <p className="text-xs text-gray-500 mt-1">
                      Organize this chatbot within a specific project group
                    </p>
                  </div>

                  <Separator className="my-4" />
                  
                  <div>
                    <Label htmlFor="system-prompt">Custom System Prompt</Label>
                    <textarea
                      id="system-prompt"
                      className="min-h-[150px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D2B48C] focus:border-transparent font-mono mt-1"
                      placeholder="Enter a custom system prompt for this chatbot. Leave empty to use the app-wide system prompt."
                      defaultValue={chatbot.systemPrompt || ""}
                      onChange={(e) => {
                        // Debounced update could be implemented here if needed
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        // Only update if the value has changed
                        if (value !== chatbot.systemPrompt) {
                          updateSystemPromptMutation.mutate(value);
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Define a custom system prompt for this specific chatbot. If left empty, the app-wide system prompt will be used.
                      <br />
                      You can use the following variables:
                      <br />
                      <code className="bg-gray-100 px-1 rounded text-xs">{'{{chatbotName}}'}</code> - The name of the chatbot
                      <br />
                      <code className="bg-gray-100 px-1 rounded text-xs">{'{{contextSources}}'}</code> - The list of available context sources
                    </p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div>
                    <Label htmlFor="output-format">Output Format</Label>
                    <textarea
                      id="output-format"
                      className="min-h-[120px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D2B48C] focus:border-transparent font-mono mt-1"
                      placeholder="Specify an exact output format structure that the AI should follow. Leave empty for free-form responses."
                      defaultValue={chatbot.outputFormat || ""}
                      onChange={(e) => {
                        // Debounced update could be implemented here if needed
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        // Only update if the value has changed
                        if (value !== chatbot.outputFormat) {
                          updateOutputFormatMutation.mutate(value);
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Define a specific output format that responses must follow. This helps ensure consistent formatting of AI responses.
                      <br />
                      Example format for expense listings:
                      <br />
                      <code className="bg-gray-100 px-1 rounded text-xs whitespace-pre">Lowe's $142.06 Material for UNKNOWN Home Depot
Home Depot $410.73 Mortar for patio pavers for 1320 Mayfair
Lowe's $51.79 Interior paint for UNKNOWN</code>
                      <br />
                      This is separate from the system prompt and will override any formatting instructions there.
                    </p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="documents" className="pt-4">
                <UploadDocuments chatbotId={chatbot.id} />
                
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Uploaded Documents</h3>
                  {documentsLoading ? (
                    <p className="text-sm text-gray-500">Loading documents...</p>
                  ) : documents.length === 0 ? (
                    <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {documents.map((doc: any) => (
                        <div key={doc.id} className="border rounded-lg p-2 flex justify-between items-center">
                          <div className="truncate flex-1">
                            <p className="text-xs font-medium truncate">{doc.originalName}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            className="text-gray-500 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="emails" className="pt-4">
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-sm font-medium">Summary Recipients</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEmailModalOpen(true)}
                    className="text-[#D2B48C]"
                  >
                    Add Email
                  </Button>
                </div>
                
                {recipientsLoading ? (
                  <p className="text-sm text-gray-500">Loading recipients...</p>
                ) : recipients.length === 0 ? (
                  <p className="text-sm text-gray-500">No recipients added yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recipients.map((recipient: any) => (
                      <div key={recipient.id} className="border rounded-lg p-2 flex justify-between items-center">
                        <p className="text-xs">{recipient.email}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRecipient(recipient.id)}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        chatbot={chatbot}
      />

      {/* Add Email Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Email Recipient</DialogTitle>
            <DialogDescription>
              Add an email address to receive weekly summaries
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddEmail}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="focus-visible:ring-[#D2B48C]"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                disabled={addEmailMutation.isPending}
              >
                {addEmailMutation.isPending ? "Adding..." : "Add Recipient"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Document Modal */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => confirmDeleteId && handleDeleteDocument(confirmDeleteId)}
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? "Deleting..." : "Delete Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
