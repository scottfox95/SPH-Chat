import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, Bell, Settings, FileUp, Trash2, Pencil } from "lucide-react";
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

export default function Chatbot({ id }: ChatbotProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [asanaProjectId, setAsanaProjectId] = useState("");
  const { toast } = useToast();

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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                Settings
              </TabsTrigger>
              <TabsTrigger value="documents" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
                Documents
              </TabsTrigger>
              <TabsTrigger value="emails" className="data-[state=active]:bg-[#D2B48C] data-[state=active]:text-white">
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
