import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Mail, Download, Calendar, Plus, Building, Activity, User, Send, Trash2, BarChart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Summaries() {
  const [view, setView] = useState<"chatbots" | "projects">("projects");
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [selectedSummary, setSelectedSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateDailyModalOpen, setGenerateDailyModalOpen] = useState(false);
  const [generateWeekToDateModalOpen, setGenerateWeekToDateModalOpen] = useState(false);
  const [slackChannelInput, setSlackChannelInput] = useState("");
  const [dailySlackChannelInput, setDailySlackChannelInput] = useState("");
  const [weekToDateSlackChannelInput, setWeekToDateSlackChannelInput] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Schemas
  const addEmailSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
  });

  // Forms
  const emailForm = useForm({
    resolver: zodResolver(addEmailSchema),
    defaultValues: {
      email: "",
    },
  });

  // Fetch chatbots
  const { data: chatbots = [] } = useQuery({
    queryKey: ["/api/chatbots"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Fetch summaries based on the selected entity and view
  const { data: summaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: view === "chatbots" 
      ? [`/api/chatbots/${selectedEntity}/summaries`]
      : [`/api/projects/${selectedEntity}/summaries`],
    enabled: !!selectedEntity,
  });

  // Fetch email recipients for the selected entity
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: view === "chatbots" 
      ? [`/api/chatbots/${selectedEntity}/recipients`]
      : [`/api/projects/${selectedEntity}/recipients`],
    enabled: !!selectedEntity,
  });

  // Add email recipient mutation
  const addRecipientMutation = useMutation({
    mutationFn: async (email: string) => {
      const endpoint = view === "chatbots"
        ? `/api/chatbots/${selectedEntity}/recipients`
        : `/api/projects/${selectedEntity}/recipients`;
      
      return apiRequest("POST", endpoint, {
        email,
        [view === "chatbots" ? "chatbotId" : "projectId"]: parseInt(selectedEntity),
      });
    },
    onSuccess: async (response) => {
      toast({
        title: "Recipient added",
        description: "Email recipient has been added successfully",
      });
      emailForm.reset();
      setEmailModalOpen(false);
      queryClient.invalidateQueries({
        queryKey: view === "chatbots" 
          ? [`/api/chatbots/${selectedEntity}/recipients`]
          : [`/api/projects/${selectedEntity}/recipients`],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add recipient. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete email recipient mutation
  const deleteRecipientMutation = useMutation({
    mutationFn: async (id: number) => {
      const endpoint = view === "chatbots"
        ? `/api/recipients/${id}`
        : `/api/project-recipients/${id}`;
      
      return apiRequest("DELETE", endpoint);
    },
    onSuccess: async (response) => {
      toast({
        title: "Recipient removed",
        description: "Email recipient has been removed successfully",
      });
      queryClient.invalidateQueries({
        queryKey: view === "chatbots" 
          ? [`/api/chatbots/${selectedEntity}/recipients`]
          : [`/api/projects/${selectedEntity}/recipients`],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove recipient. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate weekly summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const endpoint = view === "chatbots"
        ? `/api/chatbots/${selectedEntity}/generate-summary`
        : `/api/projects/${selectedEntity}/generate-summary`;
      
      const payload = view === "projects" && slackChannelInput.trim() 
        ? { slackChannelId: slackChannelInput.trim() } 
        : {};
      
      return apiRequest("POST", endpoint, payload);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: "Summary generated",
        description: `Weekly summary has been generated ${data.slackSent ? " and sent to Slack" : ""}${data.emailSent ? " and emailed to recipients" : ""}`,
      });
      setGenerateModalOpen(false);
      setSlackChannelInput("");
      queryClient.invalidateQueries({
        queryKey: view === "chatbots" 
          ? [`/api/chatbots/${selectedEntity}/summaries`]
          : [`/api/projects/${selectedEntity}/summaries`],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Generate daily summary mutation
  const generateDailySummaryMutation = useMutation({
    mutationFn: async () => {
      const endpoint = view === "chatbots"
        ? `/api/chatbots/${selectedEntity}/generate-daily-summary`
        : `/api/projects/${selectedEntity}/generate-daily-summary`;
      
      const payload = view === "projects" && dailySlackChannelInput.trim() 
        ? { slackChannelId: dailySlackChannelInput.trim() } 
        : {};
      
      return apiRequest("POST", endpoint, payload);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: "Daily summary generated",
        description: `Daily summary has been generated ${data.slackSent ? " and sent to Slack" : ""}${data.emailSent ? " and emailed to recipients" : ""}`,
      });
      setGenerateDailyModalOpen(false);
      setDailySlackChannelInput("");
      queryClient.invalidateQueries({
        queryKey: view === "chatbots" 
          ? [`/api/chatbots/${selectedEntity}/summaries`]
          : [`/api/projects/${selectedEntity}/summaries`],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate daily summary. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Generate week-to-date summary mutation
  const generateWeekToDateSummaryMutation = useMutation({
    mutationFn: async () => {
      const endpoint = view === "chatbots"
        ? `/api/chatbots/${selectedEntity}/generate-week-to-date-summary`
        : `/api/projects/${selectedEntity}/generate-week-to-date-summary`;
      
      const payload = view === "projects" && weekToDateSlackChannelInput.trim() 
        ? { slackChannelId: weekToDateSlackChannelInput.trim() } 
        : {};
      
      return apiRequest("POST", endpoint, payload);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: "Week-to-date summary generated",
        description: `Week-to-date summary has been generated ${data.slackSent ? " and sent to Slack" : ""}${data.emailSent ? " and emailed to recipients" : ""}`,
      });
      setGenerateWeekToDateModalOpen(false);
      setWeekToDateSlackChannelInput("");
      queryClient.invalidateQueries({
        queryKey: view === "chatbots" 
          ? [`/api/chatbots/${selectedEntity}/summaries`]
          : [`/api/projects/${selectedEntity}/summaries`],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate week-to-date summary. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter summaries by search query
  const filteredSummaries = summaries.filter((summary: any) =>
    summary.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle email form submission
  const onEmailSubmit = (data: z.infer<typeof addEmailSchema>) => {
    addRecipientMutation.mutate(data.email);
  };

  // Handle email recipient deletion
  const handleDeleteRecipient = (id: number) => {
    deleteRecipientMutation.mutate(id);
  };

  // Get current entity name
  const getCurrentEntityName = () => {
    if (!selectedEntity) return "";
    
    if (view === "chatbots") {
      const chatbot = chatbots.find((c: any) => c.id.toString() === selectedEntity);
      return chatbot ? chatbot.name : "";
    } else {
      const project = projects.find((p: any) => p.id.toString() === selectedEntity);
      return project ? project.name : "";
    }
  };

  // Get entity label based on view
  const getEntityLabel = () => view === "chatbots" ? "chatbot" : "project";

  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Weekly Summaries</h1>
            <p className="text-sm text-gray-500">View and manage project activity reports</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedEntity && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => setEmailModalOpen(true)}
                >
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Recipient</span>
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex items-center gap-1 bg-[#D2B48C] hover:bg-[#C3A379]"
                    onClick={() => setGenerateModalOpen(true)}
                  >
                    <Activity className="h-4 w-4" />
                    <span className="hidden sm:inline">Weekly Summary</span>
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    className="flex items-center gap-1 bg-[#80A3C9] hover:bg-[#6989AF]"
                    onClick={() => setGenerateDailyModalOpen(true)}
                  >
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Daily Summary</span>
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    className="flex items-center gap-1 bg-[#91C499] hover:bg-[#78B080]"
                    onClick={() => setGenerateWeekToDateModalOpen(true)}
                  >
                    <BarChart className="h-4 w-4" />
                    <span className="hidden sm:inline">Week-to-Date</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="projects" className="mb-6" onValueChange={(value) => {
          setView(value as "chatbots" | "projects");
          setSelectedEntity("");
          setSearchQuery("");
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="projects" className="flex items-center gap-1">
              <Building className="h-4 w-4" />
              Project Summaries
            </TabsTrigger>
            <TabsTrigger value="chatbots" className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Chatbot Summaries
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="projects" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="w-full md:w-[250px]">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search summaries..."
                  className="pl-8 focus-visible:ring-[#D2B48C]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!selectedEntity}
                />
              </div>
            </div>
            
            <RenderSummaries
              selectedEntity={selectedEntity}
              summariesLoading={summariesLoading}
              filteredSummaries={filteredSummaries}
              searchQuery={searchQuery}
              setSelectedSummary={setSelectedSummary}
              entityType="project"
            />
          </TabsContent>
          
          <TabsContent value="chatbots" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="w-full md:w-[250px]">
                  <SelectValue placeholder="Select a chatbot" />
                </SelectTrigger>
                <SelectContent>
                  {chatbots.map((chatbot: any) => (
                    <SelectItem key={chatbot.id} value={chatbot.id.toString()}>
                      {chatbot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search summaries..."
                  className="pl-8 focus-visible:ring-[#D2B48C]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!selectedEntity}
                />
              </div>
            </div>
            
            <RenderSummaries
              selectedEntity={selectedEntity}
              summariesLoading={summariesLoading}
              filteredSummaries={filteredSummaries}
              searchQuery={searchQuery}
              setSelectedSummary={setSelectedSummary}
              entityType="chatbot"
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Summary Detail Modal */}
      {selectedSummary && (
        <Dialog open={!!selectedSummary} onOpenChange={() => setSelectedSummary(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Week {selectedSummary.week} - {format(new Date(selectedSummary.sentAt), "MMMM d, yyyy")}
              </DialogTitle>
              {selectedSummary.projectName && (
                <DialogDescription>
                  {selectedSummary.projectName}
                </DialogDescription>
              )}
              {selectedSummary.chatbotName && (
                <DialogDescription>
                  {selectedSummary.chatbotName}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="mt-4">
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selectedSummary.content }} />
            </div>
            <DialogFooter className="flex justify-end mt-6">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => {
                  // Create a download link for the HTML content
                  const blob = new Blob([selectedSummary.content], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `weekly-summary-${selectedSummary.week}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" />
                Download HTML
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Email Recipient Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Email Recipient</DialogTitle>
            <DialogDescription>
              Add an email address to receive weekly summaries for {getCurrentEntityName()}.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Separator />
              
              <div className="max-h-40 overflow-y-auto">
                <h4 className="text-sm font-medium mb-2">Current Recipients</h4>
                {recipientsLoading ? (
                  <p className="text-sm text-gray-500">Loading recipients...</p>
                ) : recipients.length === 0 ? (
                  <p className="text-sm text-gray-500">No recipients added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map((recipient: any) => (
                      <div key={recipient.id} className="flex justify-between items-center text-sm border rounded-md p-2">
                        <span>{recipient.email}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRecipient(recipient.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={addRecipientMutation.isPending}
                  className="bg-[#D2B48C] hover:bg-[#C3A379]"
                >
                  {addRecipientMutation.isPending ? 'Adding...' : 'Add Recipient'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Generate Summary Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Summary</DialogTitle>
            <DialogDescription>
              Generate a weekly summary for {getCurrentEntityName()}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {view === "projects" && (
              <div>
                <label className="text-sm font-medium">Slack Channel ID (optional)</label>
                <Input
                  placeholder="C01A2BC3DEF"
                  value={slackChannelInput}
                  onChange={(e) => setSlackChannelInput(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If provided, the summary will be sent to this Slack channel.
                </p>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium mb-2">Email Recipients</h4>
              {recipientsLoading ? (
                <p className="text-sm text-gray-500">Loading recipients...</p>
              ) : recipients.length === 0 ? (
                <div className="text-sm text-amber-500 bg-amber-50 p-2 rounded">
                  No email recipients configured. The summary won't be emailed.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recipients.map((recipient: any) => (
                    <Badge key={recipient.id} variant="outline">
                      {recipient.email}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Summary Contents</h4>
              <p className="text-sm text-gray-600">
                The summary will include activity from the past week and will be organized into sections.
                {view === "projects" && " It will combine data from all chatbots within this project."}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              onClick={() => generateSummaryMutation.mutate()}
              disabled={generateSummaryMutation.isPending}
              className="bg-[#D2B48C] hover:bg-[#C3A379] flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {generateSummaryMutation.isPending ? 'Generating...' : 'Generate Summary'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Generate Daily Summary Modal */}
      <Dialog open={generateDailyModalOpen} onOpenChange={setGenerateDailyModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Daily Summary</DialogTitle>
            <DialogDescription>
              Generate a summary of yesterday's activities for {getCurrentEntityName()}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {view === "projects" && (
              <div>
                <label className="text-sm font-medium">Slack Channel ID (optional)</label>
                <Input
                  placeholder="C01A2BC3DEF"
                  value={dailySlackChannelInput}
                  onChange={(e) => setDailySlackChannelInput(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If provided, the summary will be sent to this Slack channel.
                </p>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium mb-2">Email Recipients</h4>
              {recipientsLoading ? (
                <p className="text-sm text-gray-500">Loading recipients...</p>
              ) : recipients.length === 0 ? (
                <div className="text-sm text-amber-500 bg-amber-50 p-2 rounded">
                  No email recipients configured. The summary won't be emailed.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recipients.map((recipient: any) => (
                    <Badge key={recipient.id} variant="outline" className="px-2 py-1">
                      {recipient.email}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              onClick={() => generateDailySummaryMutation.mutate()}
              disabled={generateDailySummaryMutation.isPending}
              className="bg-[#80A3C9] hover:bg-[#6989AF] flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              {generateDailySummaryMutation.isPending ? 'Generating...' : 'Generate Daily Summary'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Generate Week-to-Date Summary Modal */}
      <Dialog open={generateWeekToDateModalOpen} onOpenChange={setGenerateWeekToDateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Week-to-Date Summary</DialogTitle>
            <DialogDescription>
              Generate a summary of this week's activities (so far) for {getCurrentEntityName()}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {view === "projects" && (
              <div>
                <label className="text-sm font-medium">Slack Channel ID (optional)</label>
                <Input
                  placeholder="C01A2BC3DEF"
                  value={weekToDateSlackChannelInput}
                  onChange={(e) => setWeekToDateSlackChannelInput(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If provided, the summary will be sent to this Slack channel.
                </p>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium mb-2">Email Recipients</h4>
              {recipientsLoading ? (
                <p className="text-sm text-gray-500">Loading recipients...</p>
              ) : recipients.length === 0 ? (
                <div className="text-sm text-amber-500 bg-amber-50 p-2 rounded">
                  No email recipients configured. The summary won't be emailed.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recipients.map((recipient: any) => (
                    <Badge key={recipient.id} variant="outline" className="px-2 py-1">
                      {recipient.email}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              onClick={() => generateWeekToDateSummaryMutation.mutate()}
              disabled={generateWeekToDateSummaryMutation.isPending}
              className="bg-[#91C499] hover:bg-[#78B080] flex items-center gap-2"
            >
              <BarChart className="h-4 w-4" />
              {generateWeekToDateSummaryMutation.isPending ? 'Generating...' : 'Generate Week-to-Date Summary'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper component for rendering summaries
function RenderSummaries({ 
  selectedEntity, 
  summariesLoading, 
  filteredSummaries, 
  searchQuery, 
  setSelectedSummary,
  entityType
}: {
  selectedEntity: string;
  summariesLoading: boolean;
  filteredSummaries: any[];
  searchQuery: string;
  setSelectedSummary: (summary: any) => void;
  entityType: "chatbot" | "project";
}) {
  if (!selectedEntity) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Mail className="h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium">Select a {entityType}</h3>
          <p className="text-sm text-gray-500 mt-1">
            Choose a {entityType} to view its weekly summaries
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (summariesLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin h-6 w-6 border-2 border-[#D2B48C] border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  if (filteredSummaries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Calendar className="h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium">No summaries found</h3>
          <p className="text-sm text-gray-500 mt-1">
            {searchQuery
              ? "No summaries match your search query"
              : "No weekly summaries have been generated yet"}
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredSummaries.map((summary: any) => (
        <Card key={summary.id} className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Week {summary.week}
            </CardTitle>
            <CardDescription>
              Generated on {format(new Date(summary.sentAt), "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-20 overflow-hidden text-sm text-gray-600 mb-4">
              <div dangerouslySetInnerHTML={{ 
                __html: summary.content.substring(0, 150) + "..." 
              }} />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-[#D2B48C]"
              onClick={() => setSelectedSummary(summary)}
            >
              View Summary
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
