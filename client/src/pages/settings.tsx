import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AsanaProjectsList from "@/components/settings/asana-projects-list";

import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  AlertCircle, 
  Bell, 
  File, 
  MessageSquare,
  Settings as SettingsIcon,
  UserIcon,
  KeyIcon,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  MessageCircle,
  Calendar,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [slackToken, setSlackToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [asanaPAT, setAsanaPAT] = useState("");
  const [emailSettings, setEmailSettings] = useState({
    enabled: true,
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
  });
  const [schedulerSettings, setSchedulerSettings] = useState({
    enableDailySchedule: false,
    dailyScheduleTime: "08:00",
    enableWeeklySchedule: false,
    weeklyScheduleDay: "Monday",
    weeklyScheduleTime: "08:00",
  });
  
  // Project-specific scheduler settings
  const [projectSchedulerSettings, setProjectSchedulerSettings] = useState<{
    [projectId: number]: {
      enabled: boolean;
      scheduleType: 'daily' | 'weekly' | 'both';
      slackChannelId: string;
      emailRecipients: string;
      includeInGlobalSummaries: boolean;
    }
  }>({});
  const [testEmailAddress, setTestEmailAddress] = useState("");
  
  // Connection testing states
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<null | {
    connected: boolean;
    message?: string;
    error?: string;
  }>(null);
  
  const [testingSlack, setTestingSlack] = useState(false);
  const [slackStatus, setSlackStatus] = useState<null | {
    connected: boolean;
    teamName?: string;
    botName?: string;
    error?: string;
  }>(null);
  
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [openAIStatus, setOpenAIStatus] = useState<null | {
    connected: boolean;
    model?: string;
    error?: string;
  }>(null);
  
  const [testingAsana, setTestingAsana] = useState(false);
  const [asanaStatus, setAsanaStatus] = useState<null | {
    connected: boolean;
    workspaces?: any[];
    error?: string;
  }>(null);
  
  // API tokens status
  const { data: tokenStatus, isLoading: isLoadingTokenStatus } = useQuery({
    queryKey: ['/api/settings/api-tokens/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/settings/api-tokens/status');
      return response.json();
    }
  });

  // Fetch app settings
  const { 
    data: settings, 
    isLoading: isLoadingSettings,
    refetch: refetchSettings
  } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: () => fetch('/api/settings').then(res => res.json())
  });
  
  // Load stored credentials and settings
  useEffect(() => {
    // API keys would normally not be exposed to the client 
    // This is just for demo purposes
    const checkSecrets = async () => {
      try {
        // Check if API credentials are available
        const slackResp = await fetch("/api/system/test-slack");
        if (slackResp.ok) {
          const data = await slackResp.json();
          setSlackStatus(data);
        }
        
        const openaiResp = await fetch("/api/system/test-openai");
        if (openaiResp.ok) {
          const data = await openaiResp.json();
          setOpenAIStatus(data);
        }
        
        const asanaResp = await fetch("/api/system/test-asana");
        if (asanaResp.ok) {
          const data = await asanaResp.json();
          setAsanaStatus(data);
        }
      } catch (error) {
        console.error("Error checking API credentials:", error);
      }
    };
    
    checkSecrets();
  }, []);
  
  // Load stored email settings when app settings are retrieved
  useEffect(() => {
    if (settings) {
      setEmailSettings({
        enabled: settings.smtpEnabled || false,
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort || "587",
        smtpUser: settings.smtpUser || "",
        smtpPass: settings.smtpPass || "",
        smtpFrom: settings.smtpFrom || "",
      });
      
      // Load scheduler settings
      setSchedulerSettings({
        enableDailySchedule: settings.enableDailySchedule || false,
        dailyScheduleTime: settings.dailyScheduleTime || "08:00",
        enableWeeklySchedule: settings.enableWeeklySchedule || false,
        weeklyScheduleDay: settings.weeklyScheduleDay || "Monday",
        weeklyScheduleTime: settings.weeklyScheduleTime || "08:00"
      });
      
      // Load project scheduler settings
      if (settings.projectSchedulerSettings) {
        try {
          const projectSettings = typeof settings.projectSchedulerSettings === 'string' 
            ? JSON.parse(settings.projectSchedulerSettings) 
            : settings.projectSchedulerSettings;
          
          setProjectSchedulerSettings(projectSettings);
        } catch (error) {
          console.error("Error parsing project scheduler settings:", error);
        }
      }
    }
  }, [settings]);

  // Fetch Slack channels
  const { 
    data: slackChannels, 
    isLoading: isLoadingChannels 
  } = useQuery({
    queryKey: ['/api/system/slack-channels'],
    queryFn: () => fetch('/api/system/slack-channels').then(res => res.json())
  });
  
  // Fetch projects for scheduler settings
  const { 
    data: projects, 
    isLoading: isLoadingProjects 
  } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: () => fetch('/api/projects').then(res => res.json())
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { 
      openaiModel: string, 
      includeSourceDetails?: boolean,
      includeDateInSource?: boolean, 
      includeUserInSource?: boolean,
      responseTemplate?: string,
      summaryPrompt?: string 
    }) => {
      const response = await apiRequest('PUT', '/api/settings', data);
      return response.json();
    },
    onSuccess: async () => {
      // Force an immediate refetch of settings
      await refetchSettings();
      
      toast({
        title: "Settings updated",
        description: "AI settings have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update settings",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });

  const updateApiTokenMutation = useMutation({
    mutationFn: async (data: { 
      type: string, 
      token: string 
    }) => {
      const response = await apiRequest('PUT', '/api/settings/api-tokens', data);
      return response.json();
    },
    onSuccess: async () => {
      // Force an immediate refetch of settings and token status
      await refetchSettings();
      await queryClient.invalidateQueries({ queryKey: ['/api/settings/api-tokens/status'] });
      
      toast({
        title: "API token updated",
        description: "Token has been saved successfully.",
      });
      
      // Reset connection statuses after saving new credentials
      setSlackStatus(null);
      setOpenAIStatus(null);
      setAsanaStatus(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update token",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });

  const handleSaveApiSettings = () => {
    if (slackToken) {
      updateApiTokenMutation.mutate({ type: 'slack', token: slackToken });
    }
    
    if (openaiKey) {
      updateApiTokenMutation.mutate({ type: 'openai', token: openaiKey });
    }
    
    if (asanaPAT) {
      updateApiTokenMutation.mutate({ type: 'asana', token: asanaPAT });
    }
    
    // Reset connection statuses after saving new credentials
    setSlackStatus(null);
    setOpenAIStatus(null);
    setAsanaStatus(null);
  };

  const updateEmailSettingsMutation = useMutation({
    mutationFn: async (data: { 
      smtpEnabled: boolean, 
      smtpHost: string | null, 
      smtpPort: string | null, 
      smtpUser: string | null, 
      smtpPass: string | null,
      smtpFrom: string | null
    }) => {
      const response = await apiRequest('PUT', '/api/settings/email', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email settings saved",
        description: "Email settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save email settings",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });
  
  const updateSchedulerSettingsMutation = useMutation({
    mutationFn: async (data: { 
      enableDailySchedule: boolean,
      dailyScheduleTime: string,
      enableWeeklySchedule: boolean,
      weeklyScheduleDay: string,
      weeklyScheduleTime: string,
      projectSchedulerSettings?: any
    }) => {
      const response = await apiRequest('PUT', '/api/settings/scheduler', data);
      return response.json();
    },
    onSuccess: async () => {
      await refetchSettings();
      
      toast({
        title: "Scheduler settings saved",
        description: "Scheduled summary settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save scheduler settings",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  });

  const handleSaveEmailSettings = () => {
    updateEmailSettingsMutation.mutate({
      smtpEnabled: emailSettings.enabled,
      smtpHost: emailSettings.smtpHost || null,
      smtpPort: emailSettings.smtpPort || "587",
      smtpUser: emailSettings.smtpUser || null,
      smtpPass: emailSettings.smtpPass || null,
      smtpFrom: emailSettings.smtpFrom || null
    });
  };
  
  const handleSaveSchedulerSettings = () => {
    updateSchedulerSettingsMutation.mutate({
      enableDailySchedule: schedulerSettings.enableDailySchedule,
      dailyScheduleTime: schedulerSettings.dailyScheduleTime,
      enableWeeklySchedule: schedulerSettings.enableWeeklySchedule,
      weeklyScheduleDay: schedulerSettings.weeklyScheduleDay,
      weeklyScheduleTime: schedulerSettings.weeklyScheduleTime,
      projectSchedulerSettings: projectSchedulerSettings
    });
  };
  
  // Helper function to update project scheduler settings
  const updateProjectSchedulerSetting = (
    projectId: number, 
    field: string, 
    value: any
  ) => {
    setProjectSchedulerSettings(prev => {
      // Create a copy of the current settings
      const updated = { ...prev };
      
      // Initialize project settings if they don't exist
      if (!updated[projectId]) {
        updated[projectId] = {
          enabled: false,
          scheduleType: 'both',
          slackChannelId: '',
          emailRecipients: '',
          includeInGlobalSummaries: true
        };
      }
      
      // Update the specific field
      updated[projectId] = {
        ...updated[projectId],
        [field]: value
      };
      
      return updated;
    });
  };
  
  // Test email connection
  const testEmailConnection = async () => {
    setTestingEmail(true);
    setEmailStatus(null);
    
    try {
      // First save the settings, then test the connection
      await updateEmailSettingsMutation.mutateAsync({
        smtpEnabled: emailSettings.enabled,
        smtpHost: emailSettings.smtpHost || null,
        smtpPort: emailSettings.smtpPort || "587",
        smtpUser: emailSettings.smtpUser || null,
        smtpPass: emailSettings.smtpPass || null,
        smtpFrom: emailSettings.smtpFrom || null
      });
      
      // Then test the connection, adding the test email address if provided
      let url = "/api/system/test-email";
      if (testEmailAddress) {
        url += `?email=${encodeURIComponent(testEmailAddress)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      setEmailStatus(data);
      
      if (data.connected) {
        toast({
          title: "Email connection successful",
          description: data.message || "Test email sent successfully",
        });
      } else {
        toast({
          title: "Email connection failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      setEmailStatus({
        connected: false,
        error: "Network error checking email connection",
      });
      
      toast({
        title: "Email connection check failed",
        description: "Could not connect to the server",
        variant: "destructive",
      });
    } finally {
      setTestingEmail(false);
    }
  };
  
  // Test Slack connection
  const testSlackConnection = async () => {
    setTestingSlack(true);
    setSlackStatus(null);
    
    try {
      const response = await fetch("/api/system/test-slack");
      const data = await response.json();
      
      setSlackStatus(data);
      
      if (data.connected) {
        toast({
          title: "Slack connection successful",
          description: `Connected to ${data.teamName} as ${data.botName}`,
        });
      } else {
        toast({
          title: "Slack connection failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      setSlackStatus({
        connected: false,
        error: "Network error checking Slack connection",
      });
      
      toast({
        title: "Slack connection check failed",
        description: "Could not connect to the server",
        variant: "destructive",
      });
    } finally {
      setTestingSlack(false);
    }
  };
  
  // Test OpenAI connection
  const testOpenAIConnection = async () => {
    setTestingOpenAI(true);
    setOpenAIStatus(null);
    
    try {
      const response = await fetch("/api/system/test-openai");
      const data = await response.json();
      
      setOpenAIStatus(data);
      
      if (data.connected) {
        toast({
          title: "OpenAI connection successful",
          description: `Connected to model: ${data.model}`,
        });
      } else {
        toast({
          title: "OpenAI connection failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      setOpenAIStatus({
        connected: false,
        error: "Network error checking OpenAI connection",
      });
      
      toast({
        title: "OpenAI connection check failed",
        description: "Could not connect to the server",
        variant: "destructive",
      });
    } finally {
      setTestingOpenAI(false);
    }
  };
  
  // Test Asana connection
  const testAsanaConnection = async () => {
    setTestingAsana(true);
    setAsanaStatus(null);
    
    try {
      const response = await fetch("/api/system/test-asana");
      const data = await response.json();
      
      setAsanaStatus(data);
      
      if (data.connected) {
        toast({
          title: "Asana connection successful",
          description: `Connected with access to ${data.workspaces?.length || 0} workspace(s)`,
        });
      } else {
        toast({
          title: "Asana connection failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      setAsanaStatus({
        connected: false,
        error: "Network error checking Asana connection",
      });
      
      toast({
        title: "Asana connection check failed",
        description: "Could not connect to the server",
        variant: "destructive",
      });
    } finally {
      setTestingAsana(false);
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="text-sm text-gray-500">Manage your SPH ChatBot configuration</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asana Projects List Section */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-semibold mb-4">External Integrations</h2>
          </div>
          
          {/* Asana Projects Directory */}
          <div className="lg:col-span-3">
            <AsanaProjectsList />
          </div>
          {/* API Tokens */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyIcon className="h-5 w-5 text-[#D2B48C]" />
                API Settings
              </CardTitle>
              <CardDescription>
                Configure API tokens for external services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="slack-token">Slack Bot Token</Label>
                  <div className="flex items-center gap-2">
                    {!isLoadingTokenStatus && tokenStatus?.slack?.exists && (
                      <Badge className="mb-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
                        <Database className="w-3 h-3 mr-1" />
                        Stored
                      </Badge>
                    )}
                    {slackStatus !== null && (
                      <Badge 
                        className={`mb-1 ${slackStatus.connected ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}`}
                      >
                        {slackStatus.connected ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {slackStatus.connected ? 'Connected' : 'Error'}
                      </Badge>
                    )}
                  </div>
                </div>
                <Input
                  id="slack-token"
                  type="password"
                  value={slackToken}
                  onChange={(e) => setSlackToken(e.target.value)}
                  placeholder="xoxb-your-slack-token"
                  className="focus-visible:ring-[#D2B48C]"
                />
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500">
                    <p>Used to connect to your Slack workspace and access channels</p>
                    {!isLoadingTokenStatus && tokenStatus?.slack?.exists && (
                      <p className="text-xs text-blue-600 mt-1">
                        Last updated: {new Date(tokenStatus.slack.lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={testSlackConnection}
                    disabled={testingSlack}
                    className="text-xs h-7"
                  >
                    {testingSlack ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Testing
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </div>
                {slackStatus?.teamName && (
                  <p className="text-xs text-green-600">
                    Connected to {slackStatus.teamName} as {slackStatus.botName}
                  </p>
                )}
                {slackStatus?.error && (
                  <p className="text-xs text-red-600">
                    Error: {slackStatus.error}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <div className="flex items-center gap-2">
                    {!isLoadingTokenStatus && tokenStatus?.openai?.exists && (
                      <Badge className="mb-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
                        <Database className="w-3 h-3 mr-1" />
                        Stored
                      </Badge>
                    )}
                    {openAIStatus !== null && (
                      <Badge 
                        className={`mb-1 ${openAIStatus.connected ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}`}
                      >
                        {openAIStatus.connected ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {openAIStatus.connected ? 'Connected' : 'Error'}
                      </Badge>
                    )}
                  </div>
                </div>
                <Input
                  id="openai-key"
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-your-openai-key"
                  className="focus-visible:ring-[#D2B48C]"
                />
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500">
                    <p>Required for AI responses and weekly summary generation</p>
                    {!isLoadingTokenStatus && tokenStatus?.openai?.exists && (
                      <p className="text-xs text-blue-600 mt-1">
                        Last updated: {new Date(tokenStatus.openai.lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={testOpenAIConnection}
                    disabled={testingOpenAI}
                    className="text-xs h-7"
                  >
                    {testingOpenAI ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Testing
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </div>
                {openAIStatus?.connected && openAIStatus.model && (
                  <p className="text-xs text-green-600">
                    Connected to model: {openAIStatus.model}
                  </p>
                )}
                {openAIStatus?.error && (
                  <p className="text-xs text-red-600">
                    Error: {openAIStatus.error}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="asana-pat">Asana Personal Access Token</Label>
                  <div className="flex items-center gap-2">
                    {!isLoadingTokenStatus && tokenStatus?.asana?.exists && (
                      <Badge className="mb-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
                        <Database className="w-3 h-3 mr-1" />
                        Stored
                      </Badge>
                    )}
                    {asanaStatus !== null && (
                      <Badge 
                        className={`mb-1 ${asanaStatus.connected ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}`}
                      >
                        {asanaStatus.connected ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {asanaStatus.connected ? 'Connected' : 'Error'}
                      </Badge>
                    )}
                  </div>
                </div>
                <Input
                  id="asana-pat"
                  type="password"
                  value={asanaPAT}
                  onChange={(e) => setAsanaPAT(e.target.value)}
                  placeholder="1/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="focus-visible:ring-[#D2B48C]"
                />
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500">
                    <p>Required to access Asana projects and tasks</p>
                    {!isLoadingTokenStatus && tokenStatus?.asana?.exists && (
                      <p className="text-xs text-blue-600 mt-1">
                        Last updated: {new Date(tokenStatus.asana.lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={testAsanaConnection}
                    disabled={testingAsana}
                    className="text-xs h-7"
                  >
                    {testingAsana ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Testing
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </div>
                {asanaStatus?.connected && asanaStatus.workspaces && (
                  <p className="text-xs text-green-600">
                    Connected with access to {asanaStatus.workspaces.length} workspace(s)
                  </p>
                )}
                {asanaStatus?.error && (
                  <p className="text-xs text-red-600">
                    Error: {asanaStatus.error}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveApiSettings}
                className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
              >
                Save API Settings
              </Button>
            </CardFooter>
          </Card>

          {/* User Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-[#D2B48C]" />
                User Profile
              </CardTitle>
              <CardDescription>
                Your account information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#A0522D] text-white flex items-center justify-center text-xl font-medium">
                  {user?.initial || "U"}
                </div>
                <div>
                  <p className="font-medium">{user?.displayName || "User"}</p>
                  <p className="text-sm text-gray-500">{user?.username || "username"}</p>
                  <p className="text-xs mt-1 bg-gray-100 rounded-full px-2 py-0.5 inline-block">
                    {user?.role === "admin" ? "Admin" : "User"}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="text-sm">
                <p className="text-gray-500">
                  To change your password, please contact your system administrator.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#D2B48C]" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Configure email delivery for weekly summaries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-enabled">Email Delivery</Label>
                  <p className="text-xs text-gray-500">Enable or disable email notifications</p>
                </div>
                <Switch
                  id="email-enabled"
                  checked={emailSettings.enabled}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, enabled: checked })}
                  className="data-[state=checked]:bg-[#D2B48C]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input
                  id="smtp-host"
                  value={emailSettings.smtpHost}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                  placeholder="smtp.example.com"
                  disabled={!emailSettings.enabled}
                  className="focus-visible:ring-[#D2B48C]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="smtp-port">SMTP Port</Label>
                <Input
                  id="smtp-port"
                  value={emailSettings.smtpPort}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                  placeholder="587"
                  disabled={!emailSettings.enabled}
                  className="focus-visible:ring-[#D2B48C]"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">SMTP Username</Label>
                  <Input
                    id="smtp-user"
                    value={emailSettings.smtpUser}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                    placeholder="username"
                    disabled={!emailSettings.enabled}
                    className="focus-visible:ring-[#D2B48C]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="smtp-pass">SMTP Password</Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    value={emailSettings.smtpPass}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPass: e.target.value })}
                    placeholder="password"
                    disabled={!emailSettings.enabled}
                    className="focus-visible:ring-[#D2B48C]"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="smtp-from">From Address</Label>
                <Input
                  id="smtp-from"
                  value={emailSettings.smtpFrom}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpFrom: e.target.value })}
                  placeholder='"SPH Notifications" <notifications@example.com>'
                  disabled={!emailSettings.enabled}
                  className="focus-visible:ring-[#D2B48C]"
                />
                <p className="text-xs text-gray-500">The email address that will appear in the "From" field</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-4">
              <div>
                <Button 
                  onClick={handleSaveEmailSettings}
                  disabled={!emailSettings.enabled}
                  className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                >
                  Save Email Settings
                </Button>
                {emailStatus !== null && (
                  <span className={`ml-4 text-sm ${emailStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
                    {emailStatus.connected ? (
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                    ) : (
                      <XCircle className="w-4 h-4 inline mr-1" />
                    )}
                    {emailStatus.connected ? 'Connected' : 'Failed'}
                  </span>
                )}
                {emailStatus?.error && (
                  <p className="text-xs text-red-600 mt-2">
                    Error: {emailStatus.error}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Optional test email address"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    disabled={testingEmail || !emailSettings.enabled}
                    className="w-64 focus-visible:ring-[#D2B48C]"
                  />
                  <Button 
                    variant="outline" 
                    onClick={testEmailConnection}
                    disabled={testingEmail || !emailSettings.enabled || !emailSettings.smtpHost || !emailSettings.smtpUser || !emailSettings.smtpPass}
                  >
                    {testingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </div>
                {!testEmailAddress && (
                  <p className="text-xs text-gray-500">Leave empty to use your account email.</p>
                )}
              </div>
            </CardFooter>
          </Card>

          {/* AI Model Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#D2B48C]" />
                AI Model Settings
              </CardTitle>
              <CardDescription>
                Configure AI model for all SPH ChatBots
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingSettings ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="openai-model">Default OpenAI Model</Label>
                    <Select 
                      defaultValue={settings?.openaiModel || "gpt-4o"}
                      onValueChange={(value) => {
                        updateSettingsMutation.mutate({ 
                          ...settings,
                          openaiModel: value 
                        });
                      }}
                      disabled={updateSettingsMutation.isPending}
                    >
                      <SelectTrigger 
                        id="openai-model" 
                        className="focus-visible:ring-[#D2B48C]"
                      >
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings?.availableModels?.map((model: string) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        )) || (
                          <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      This model will be used for all AI responses and summary generation across all chatbots
                    </p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Source Attribution Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="include-source-details">Include Source Details</Label>
                          <p className="text-xs text-gray-500">When enabled, the AI will include source details in its responses</p>
                        </div>
                        <Switch
                          id="include-source-details"
                          checked={settings?.includeSourceDetails || false}
                          onCheckedChange={(checked) => {
                            updateSettingsMutation.mutate({
                              openaiModel: settings?.openaiModel || "gpt-4o",
                              includeSourceDetails: checked,
                              includeUserInSource: settings?.includeUserInSource || false,
                              includeDateInSource: settings?.includeDateInSource || false
                            });
                          }}
                          disabled={updateSettingsMutation.isPending}
                          className="data-[state=checked]:bg-[#D2B48C]"
                        />
                      </div>
                      
                      <div className="space-y-4 pl-4 border-l-2 border-gray-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="include-user-in-source">Include User Names</Label>
                            <p className="text-xs text-gray-500">Include the name of the person who sent the message</p>
                          </div>
                          <Switch
                            id="include-user-in-source"
                            checked={settings?.includeUserInSource || false}
                            onCheckedChange={(checked) => {
                              updateSettingsMutation.mutate({
                                openaiModel: settings?.openaiModel || "gpt-4o",
                                includeSourceDetails: settings?.includeSourceDetails || false,
                                includeUserInSource: checked,
                                includeDateInSource: settings?.includeDateInSource || false
                              });
                            }}
                            disabled={!(settings?.includeSourceDetails) || updateSettingsMutation.isPending}
                            className="data-[state=checked]:bg-[#D2B48C]"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="include-date-in-source">Include Dates</Label>
                            <p className="text-xs text-gray-500">Include the date and time when the message was sent</p>
                          </div>
                          <Switch
                            id="include-date-in-source"
                            checked={settings?.includeDateInSource || false}
                            onCheckedChange={(checked) => {
                              updateSettingsMutation.mutate({
                                openaiModel: settings?.openaiModel || "gpt-4o",
                                includeSourceDetails: settings?.includeSourceDetails || false,
                                includeUserInSource: settings?.includeUserInSource || false,
                                includeDateInSource: checked
                              });
                            }}
                            disabled={!(settings?.includeSourceDetails) || updateSettingsMutation.isPending}
                            className="data-[state=checked]:bg-[#D2B48C]"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-amber-50 rounded-md text-amber-800 text-xs">
                      <p>Example response with source attribution:</p>
                      <p className="mt-1 font-medium">
                        "The AC unit is currently on order and is expected to arrive this week, 
                        {settings?.includeSourceDetails && ' according to the Slack message'}
                        {settings?.includeSourceDetails && settings?.includeUserInSource && ' sent by Aaron Wilson'}
                        {settings?.includeSourceDetails && settings?.includeDateInSource && ' on 4/14/2025 at 8:08:05 PM'}.
                        "
                      </p>
                    </div>
                    
                    {/* Debug section to show current state */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-md text-slate-800 text-xs">
                      <p className="font-medium mb-1">Current settings:</p>
                      <p>Include Source Details: {settings?.includeSourceDetails ? 'Yes' : 'No'}</p>
                      <p>Include User in Source: {settings?.includeUserInSource ? 'Yes' : 'No'}</p>
                      <p>Include Date in Source: {settings?.includeDateInSource ? 'Yes' : 'No'}</p>
                    </div>
                  </div>

                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">System Prompt Template</h3>
                    <div className="space-y-2">
                      <Label htmlFor="system-prompt">Default System Prompt</Label>
                      <textarea
                        id="system-prompt"
                        className="min-h-[200px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D2B48C] focus:border-transparent font-mono"
                      >{settings?.responseTemplate || ""}</textarea>
                      <div className="text-xs text-gray-500">
                        <p>This template will be used as the system prompt for all chatbots. You can use the following variables:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          <li><code className="bg-gray-100 px-1 rounded">{'{{chatbotName}}'}</code> - The name of the chatbot</li>
                          <li><code className="bg-gray-100 px-1 rounded">{'{{contextSources}}'}</code> - The list of available context sources</li>
                        </ul>
                      </div>
                      <div className="flex justify-between mt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            // Set the default template in the textarea
                            const defaultTemplate = `You are a helpful assistant named SPH ChatBot assigned to the {{chatbotName}} homebuilding project. Your role is to provide project managers and executives with accurate, up-to-date answers about this construction project by referencing the following sources of information:

{{contextSources}}

Your job is to answer questions clearly and concisely. Always cite your source. If your answer comes from:
- a document: mention the filename and, if available, the page or section.
- Slack: mention the date and approximate time of the Slack message.
{{asanaNote}}

IMPORTANT FOR ASANA TASKS: 
1. When users ask about "tasks", "Asana", "project status", "overdue", "upcoming", "progress", or other task-related information, ALWAYS prioritize checking the Asana data.
2. Pay special attention to content that begins with "ASANA TASK DATA:" in your provided context. This contains valuable task information.
3. When answering Asana-related questions, directly reference the tasks, including their status, due dates, and assignees if available.
4. Try to match the user's question with the most relevant task view (all tasks, overdue tasks, upcoming tasks, or completed tasks).

Respond using complete sentences. If the information is unavailable, say:  
"I wasn't able to find that information in the project files or messages."

You should **never make up information**. You may summarize or synthesize details if the answer is spread across multiple sources.`;
                            
                            // Update the textarea
                            const textarea = document.getElementById('system-prompt') as HTMLTextAreaElement;
                            if (textarea) {
                              textarea.value = defaultTemplate;
                            }
                          }}
                          className="text-gray-500"
                        >
                          Reset to Default
                        </Button>
                        
                        <Button
                          onClick={() => {
                            // Get current value from the textarea
                            const template = (document.getElementById('system-prompt') as HTMLTextAreaElement)?.value;
                            
                            updateSettingsMutation.mutate({
                              openaiModel: settings?.openaiModel || "gpt-4o",
                              includeSourceDetails: settings?.includeSourceDetails || false,
                              includeUserInSource: settings?.includeUserInSource || false,
                              includeDateInSource: settings?.includeDateInSource || false,
                              responseTemplate: template
                            });
                          }}
                          disabled={updateSettingsMutation.isPending}
                          className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                        >
                          {updateSettingsMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Template'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Weekly Summary Prompt</h3>
                    <div className="space-y-2">
                      <Label htmlFor="summary-prompt">Weekly Summary Generation Prompt</Label>
                      <textarea
                        id="summary-prompt"
                        className="min-h-[200px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D2B48C] focus:border-transparent font-mono"
                      >{settings?.summaryPrompt || ""}</textarea>
                      <div className="text-xs text-gray-500">
                        <p>This prompt will be used to generate weekly summaries from Slack messages. You can use the following variables:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          <li><code className="bg-gray-100 px-1 rounded">{'{{projectName}}'}</code> - The name of the project</li>
                        </ul>
                      </div>
                      <div className="flex justify-between mt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            // Set the default template in the textarea
                            const defaultTemplate = `You are an expert construction project manager. Create a concise weekly summary of activity for the {{projectName}} homebuilding project based on Slack channel messages. Focus on key decisions, progress updates, issues, and upcoming milestones. Format the summary in HTML with sections for: 1) Key Achievements, 2) Issues or Blockers, 3) Upcoming Work, and 4) Action Items. Keep it professional and informative.`;
                            
                            // Update the textarea
                            const textarea = document.getElementById('summary-prompt') as HTMLTextAreaElement;
                            if (textarea) {
                              textarea.value = defaultTemplate;
                            }
                          }}
                          className="text-gray-500"
                        >
                          Reset to Default
                        </Button>
                        
                        <Button
                          onClick={() => {
                            // Get current value from the textarea
                            const summaryPrompt = (document.getElementById('summary-prompt') as HTMLTextAreaElement)?.value;
                            
                            updateSettingsMutation.mutate({
                              openaiModel: settings?.openaiModel || "gpt-4o",
                              includeSourceDetails: settings?.includeSourceDetails || false,
                              includeUserInSource: settings?.includeUserInSource || false,
                              includeDateInSource: settings?.includeDateInSource || false,
                              responseTemplate: settings?.responseTemplate || null,
                              summaryPrompt: summaryPrompt
                            });
                          }}
                          disabled={updateSettingsMutation.isPending}
                          className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                        >
                          {updateSettingsMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Prompt'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {updateSettingsMutation.isPending && (
                    <p className="text-xs text-amber-600 flex items-center mt-2">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Updating settings...
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Scheduler Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#D2B48C]" />
                Scheduled Summaries
              </CardTitle>
              <CardDescription>
                Configure automated daily and weekly summary generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingSettings || isLoadingProjects ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <div className="space-y-6">
                    <div className="border rounded-md p-4">
                      <h3 className="text-base font-medium mb-4">Global Settings</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        These settings apply as defaults for all projects unless overridden by project-specific settings.
                      </p>
                      
                      <div className="border-t pt-4 mt-2 space-y-4">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch
                            id="enable-daily-schedule"
                            checked={schedulerSettings.enableDailySchedule}
                            onCheckedChange={(checked) => setSchedulerSettings({
                              ...schedulerSettings,
                              enableDailySchedule: checked
                            })}
                          />
                          <Label htmlFor="enable-daily-schedule" className="font-medium">Daily Summary</Label>
                        </div>
                        <div className="pl-8 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="daily-time" className="text-sm">Send at time</Label>
                              <Input
                                id="daily-time"
                                type="time"
                                value={schedulerSettings.dailyScheduleTime}
                                onChange={(e) => setSchedulerSettings({
                                  ...schedulerSettings,
                                  dailyScheduleTime: e.target.value
                                })}
                                disabled={!schedulerSettings.enableDailySchedule}
                                className="focus-visible:ring-[#D2B48C]"
                              />
                              <p className="text-xs text-gray-500">Daily summaries will be sent every weekday at this time</p>
                            </div>
                          </div>
                        </div>
                      
                        <div className="flex items-center space-x-2 mb-4 mt-4">
                          <Switch
                            id="enable-weekly-schedule"
                            checked={schedulerSettings.enableWeeklySchedule}
                            onCheckedChange={(checked) => setSchedulerSettings({
                              ...schedulerSettings,
                              enableWeeklySchedule: checked
                            })}
                          />
                          <Label htmlFor="enable-weekly-schedule" className="font-medium">Weekly Summary</Label>
                        </div>
                        <div className="pl-8 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="weekly-day" className="text-sm">Day of week</Label>
                              <Select
                                value={schedulerSettings.weeklyScheduleDay}
                                onValueChange={(value) => setSchedulerSettings({
                                  ...schedulerSettings,
                                  weeklyScheduleDay: value
                                })}
                                disabled={!schedulerSettings.enableWeeklySchedule}
                              >
                                <SelectTrigger className="focus-visible:ring-[#D2B48C]">
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Monday">Monday</SelectItem>
                                  <SelectItem value="Tuesday">Tuesday</SelectItem>
                                  <SelectItem value="Wednesday">Wednesday</SelectItem>
                                  <SelectItem value="Thursday">Thursday</SelectItem>
                                  <SelectItem value="Friday">Friday</SelectItem>
                                  <SelectItem value="Saturday">Saturday</SelectItem>
                                  <SelectItem value="Sunday">Sunday</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="weekly-time" className="text-sm">Time</Label>
                              <Input
                                id="weekly-time"
                                type="time"
                                value={schedulerSettings.weeklyScheduleTime}
                                onChange={(e) => setSchedulerSettings({
                                  ...schedulerSettings,
                                  weeklyScheduleTime: e.target.value
                                })}
                                disabled={!schedulerSettings.enableWeeklySchedule}
                                className="focus-visible:ring-[#D2B48C]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Project-specific settings */}
                    <div className="border rounded-md p-4">
                      <h3 className="text-base font-medium mb-4">Project-Specific Settings</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Configure summary schedules for individual projects. These settings override the global settings.
                      </p>
                      
                      <div className="border-t pt-4 mt-2">
                        {projects && projects.length > 0 ? (
                          <div className="space-y-6">
                            {projects.map((project: any) => {
                              const projectSettings = projectSchedulerSettings[project.id] || {
                                enabled: false,
                                scheduleType: 'both',
                                slackChannelId: '',
                                emailRecipients: '',
                                includeInGlobalSummaries: true
                              };
                              
                              return (
                                <div key={project.id} className="p-4 border rounded-md">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        id={`enable-project-${project.id}`}
                                        checked={projectSettings.enabled}
                                        onCheckedChange={(checked) => 
                                          updateProjectSchedulerSetting(project.id, 'enabled', checked)
                                        }
                                      />
                                      <Label htmlFor={`enable-project-${project.id}`} className="font-medium">
                                        {project.name}
                                      </Label>
                                    </div>
                                    <Badge 
                                      variant={projectSettings.enabled ? "default" : "outline"}
                                      className={projectSettings.enabled ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                                    >
                                      {projectSettings.enabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                  </div>
                                  
                                  {projectSettings.enabled && (
                                    <div className="pl-8 space-y-4">
                                      <div className="space-y-3">
                                        <Label className="text-sm">Summary Type</Label>
                                        <div className="flex items-center space-x-4">
                                          <div className="flex items-center space-x-2">
                                            <input 
                                              type="radio" 
                                              id={`schedule-type-daily-${project.id}`}
                                              checked={projectSettings.scheduleType === 'daily'}
                                              onChange={() => 
                                                updateProjectSchedulerSetting(project.id, 'scheduleType', 'daily')
                                              }
                                              className="h-4 w-4 text-[#D2B48C] focus:ring-[#D2B48C]"
                                            />
                                            <Label htmlFor={`schedule-type-daily-${project.id}`} className="text-sm font-normal">
                                              Daily Only
                                            </Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <input 
                                              type="radio" 
                                              id={`schedule-type-weekly-${project.id}`}
                                              checked={projectSettings.scheduleType === 'weekly'}
                                              onChange={() => 
                                                updateProjectSchedulerSetting(project.id, 'scheduleType', 'weekly')
                                              }
                                              className="h-4 w-4 text-[#D2B48C] focus:ring-[#D2B48C]"
                                            />
                                            <Label htmlFor={`schedule-type-weekly-${project.id}`} className="text-sm font-normal">
                                              Weekly Only
                                            </Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <input 
                                              type="radio" 
                                              id={`schedule-type-both-${project.id}`}
                                              checked={projectSettings.scheduleType === 'both'}
                                              onChange={() => 
                                                updateProjectSchedulerSetting(project.id, 'scheduleType', 'both')
                                              }
                                              className="h-4 w-4 text-[#D2B48C] focus:ring-[#D2B48C]"
                                            />
                                            <Label htmlFor={`schedule-type-both-${project.id}`} className="text-sm font-normal">
                                              Both
                                            </Label>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <Label htmlFor={`slack-channel-${project.id}`} className="text-sm">Slack Channel</Label>
                                        <Select
                                          value={projectSettings.slackChannelId}
                                          onValueChange={(value) => 
                                            updateProjectSchedulerSetting(project.id, 'slackChannelId', value)
                                          }
                                        >
                                          <SelectTrigger className="focus-visible:ring-[#D2B48C]">
                                            <SelectValue placeholder="Select a Slack channel" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {slackChannels && slackChannels.map((channel: any) => (
                                              <SelectItem key={channel.id} value={channel.id}>
                                                # {channel.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <p className="text-xs text-gray-500">
                                          Select the Slack channel where summaries will be posted
                                        </p>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <Label htmlFor={`email-recipients-${project.id}`} className="text-sm">Email Recipients</Label>
                                        <Input
                                          id={`email-recipients-${project.id}`}
                                          value={projectSettings.emailRecipients}
                                          onChange={(e) => 
                                            updateProjectSchedulerSetting(project.id, 'emailRecipients', e.target.value)
                                          }
                                          placeholder="email@example.com, another@example.com"
                                          className="focus-visible:ring-[#D2B48C]"
                                        />
                                        <p className="text-xs text-gray-500">
                                          Comma-separated list of email addresses that will receive the summary
                                        </p>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`include-global-${project.id}`}
                                          checked={projectSettings.includeInGlobalSummaries}
                                          onCheckedChange={(checked) => 
                                            updateProjectSchedulerSetting(
                                              project.id, 
                                              'includeInGlobalSummaries', 
                                              checked === true
                                            )
                                          }
                                        />
                                        <Label 
                                          htmlFor={`include-global-${project.id}`}
                                          className="text-sm"
                                        >
                                          Include in global summaries
                                        </Label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-gray-500">
                            <AlertCircle className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                            <p>No projects available. Add projects to configure project-specific schedules.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSaveSchedulerSettings}
                      disabled={updateSchedulerSettingsMutation.isPending}
                      className="bg-[#D2B48C] hover:bg-[#C2A47C] text-white"
                    >
                      {updateSchedulerSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Scheduler Settings'
                      )}
                    </Button>
                  </div>
                  
                  {updateSchedulerSettingsMutation.isPending && (
                    <p className="text-xs text-amber-600 flex items-center mt-2">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Updating settings...
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Slack Channels */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#D2B48C]" />
                Available Slack Channels
              </CardTitle>
              <CardDescription>
                Channels your SPH ChatBot can access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingChannels ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : slackChannels && slackChannels.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel Name</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel ID</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {slackChannels.map((channel: any) => (
                        <tr key={channel.id} className="hover:bg-gray-50">
                          <td className="py-2 px-4 text-sm"># {channel.name}</td>
                          <td className="py-2 px-4 text-sm font-mono text-gray-500">{channel.id}</td>
                          <td className="py-2 px-4 text-sm text-gray-500">{channel.numMembers || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : slackChannels && slackChannels.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                  <p>No channels available. Make sure your Slack bot is added to channels.</p>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                  <p>Failed to load Slack channels. Check your connection.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-[#D2B48C]" />
                System Information
              </CardTitle>
              <CardDescription>
                Application details and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Version</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Environment</span>
                  <span className="font-medium">development</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Storage</span>
                  <span className="font-medium">In-Memory</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Last Deployed</span>
                  <span className="font-medium">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Status</span>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-600"></span>
                  Operational
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
