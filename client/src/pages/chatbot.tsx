import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, Bell, Settings, FileUp, Trash2, Pencil, Link, PlugZap, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import EditableTitle from "@/components/shared/editable-title";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ChatInterface from "@/components/shared/chat-interface";
import ShareModal from "@/components/shared/share-modal";
import UploadDocuments from "@/components/dashboard/upload-documents";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ChatbotProps {
  id: number;
}

export default function Chatbot({ id }: ChatbotProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch chatbot data
  const { data: chatbot, isLoading: chatbotLoading } = useQuery<any>({
    queryKey: [`/api/chatbots/${id}`],
  });

  // Fetch documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery<any[]>({
    queryKey: [`/api/chatbots/${id}/documents`],
  });

  // Fetch email recipients
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery<any[]>({
    queryKey: [`/api/chatbots/${id}/recipients`],
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
      <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{chatbot.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const newName = prompt("Enter new chatbot name:", chatbot.name);
                if (newName && newName !== chatbot.name) {
                  updateNameMutation.mutate(newName);
                }
              }}
              className="h-7 w-7 hover:bg-gray-100"
            >
              <Pencil className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
          <p className="text-sm text-gray-500">SPH ChatBot Assistant</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleGenerateSummary()}
            disabled={generateSummaryMutation.isPending}
          >
            <Bell className="h-4 w-4 mr-2" />
            Generate Summary
          </Button>
          <Button 
            onClick={() => setShareModalOpen(true)}
            className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
            size="sm"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface
            chatbotId={chatbot.id}
            chatbotName={chatbot.name}
          />
        </div>

        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <Tabs defaultValue="settings" className="p-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="settings" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                Settings
              </TabsTrigger>
              <TabsTrigger value="documents" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                Documents
              </TabsTrigger>
              <TabsTrigger value="emails" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                Emails
              </TabsTrigger>
              <TabsTrigger value="asana" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                Asana
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
            
            <TabsContent value="asana" className="pt-4 space-y-4">
              <AsanaIntegration chatbotId={chatbot.id} chatbot={chatbot} />
            </TabsContent>
          </Tabs>
        </div>
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

// Asana Integration Component
interface AsanaIntegrationProps {
  chatbotId: number;
  chatbot: any;
}

function AsanaIntegration({ chatbotId, chatbot }: AsanaIntegrationProps) {
  const [asanaConnectModalOpen, setAsanaConnectModalOpen] = useState(false);
  const [connectionId, setConnectionId] = useState(chatbot.asanaConnectionId || "");
  const [selectedProjectId, setSelectedProjectId] = useState(chatbot.asanaProjectId || "");
  const { toast } = useToast();

  // Fetch projects if connection ID exists
  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery<any[]>({
    queryKey: [`/api/asana/projects/${connectionId}`],
    enabled: !!connectionId,
    queryFn: async () => {
      const res = await fetch(`/api/asana/projects/${connectionId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch Asana projects");
      }
      return res.json();
    },
  });

  // Fetch Asana tasks if connection and project are set
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: [`/api/chatbots/${chatbotId}/asana-tasks`],
    enabled: !!chatbot.asanaConnectionId && !!chatbot.asanaProjectId,
    queryFn: async () => {
      const res = await fetch(`/api/chatbots/${chatbotId}/asana-tasks`);
      if (!res.ok) {
        throw new Error("Failed to fetch Asana tasks");
      }
      return res.json();
    },
  });

  // Save Asana integration mutation
  const saveAsanaIntegrationMutation = useMutation({
    mutationFn: async (data: { asanaConnectionId: string; asanaProjectId: string }) => {
      const res = await apiRequest("POST", `/api/chatbots/${chatbotId}/asana-integration`, data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Asana integration saved",
        description: "Chatbot is now connected to Asana project.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${chatbotId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save Asana integration",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get Asana OAuth URL
  const getAsanaAuthUrlMutation = useMutation({
    mutationFn: async () => {
      // Using direct fetch instead of apiRequest because GET shouldn't have a body
      const res = await fetch("/api/asana/mcp-auth-url");
      if (!res.ok) {
        throw new Error("Failed to fetch Asana auth URL");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Open the authentication URL in a new window
      window.open(data.url, "_blank", "width=800,height=600");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to get Asana authentication URL",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle OAuth callback (this would be called by the popup window)
  const handleAsanaOAuthCallback = async (code: string) => {
    try {
      const res = await fetch("/api/asana/oauth-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setConnectionId(data.connectionId);
        toast({
          title: "Asana connected",
          description: "Successfully authenticated with Asana.",
        });
        await refetchProjects();
      } else {
        throw new Error(data.message || "Authentication failed");
      }
    } catch (error: any) {
      toast({
        title: "Authentication failed",
        description: error.message || "Failed to connect to Asana.",
        variant: "destructive",
      });
    }
  };

  // Listen for OAuth callback message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.data && event.data.type === "asana_oauth_callback" && event.data.code) {
        handleAsanaOAuthCallback(event.data.code);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleConnect = () => {
    getAsanaAuthUrlMutation.mutate();
  };

  const handleSaveIntegration = () => {
    if (connectionId && selectedProjectId) {
      saveAsanaIntegrationMutation.mutate({
        asanaConnectionId: connectionId,
        asanaProjectId: selectedProjectId,
      });
    } else {
      toast({
        title: "Missing information",
        description: "Please select an Asana project.",
        variant: "destructive",
      });
    }
  };

  const isConnected = !!chatbot.asanaConnectionId && !!chatbot.asanaProjectId;
  const isConfiguring = !!connectionId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Asana Integration</h3>
        {!isConnected && !isConfiguring && (
          <Button
            onClick={handleConnect}
            size="sm"
            className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
            disabled={getAsanaAuthUrlMutation.isPending}
          >
            <PlugZap className="h-4 w-4 mr-2" />
            Connect Asana
          </Button>
        )}
      </div>
      
      {!isConnected && !isConfiguring && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connect to Asana</CardTitle>
            <CardDescription>
              Connect this chatbot to an Asana project to allow it to reference task data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              When connected, the chatbot will be able to access tasks from the selected Asana project
              and provide information about due dates, assignees, and completion status in its responses.
            </p>
          </CardContent>
        </Card>
      )}

      {isConfiguring && !isConnected && (
        <div className="space-y-4">
          <Alert variant="default">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>Connected to Asana</AlertTitle>
            <AlertDescription>
              Select a project to complete the integration.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="project-selector">Select Asana Project</Label>
            {projectsLoading ? (
              <div className="text-sm text-gray-500">Loading projects...</div>
            ) : (
              <>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="project-selector">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: any) => (
                      <SelectItem key={project.gid} value={project.gid}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  onClick={handleSaveIntegration}
                  className="w-full mt-2 bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                  disabled={!selectedProjectId || saveAsanaIntegrationMutation.isPending}
                >
                  {saveAsanaIntegrationMutation.isPending ? "Saving..." : "Save Integration"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {isConnected && (
        <div className="space-y-4">
          <Alert variant="default">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>Integration Active</AlertTitle>
            <AlertDescription>
              This chatbot is connected to an Asana project and can access task data.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Current Project</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleConnect}
                className="text-xs"
              >
                <Link className="h-3 w-3 mr-1" /> Change
              </Button>
            </div>
            
            {projects.length > 0 && (
              <div className="p-2 bg-gray-50 rounded border text-sm">
                {projects.find((p: any) => p.gid === chatbot.asanaProjectId)?.name || chatbot.asanaProjectId}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Available Tasks</Label>
            {tasksLoading ? (
              <div className="text-sm text-gray-500">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="text-sm text-gray-500">No tasks found in this project.</div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {tasks.slice(0, 5).map((task: any) => (
                  <div key={task.gid} className="border rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate">{task.name}</p>
                      {task.completed ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                      <span>{task.assignee?.name || "Unassigned"}</span>
                      {task.due_on && <span>{new Date(task.due_on).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
                {tasks.length > 5 && (
                  <div className="text-xs text-center text-gray-500">
                    +{tasks.length - 5} more tasks
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
