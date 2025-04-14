import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [slackToken, setSlackToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [emailSettings, setEmailSettings] = useState({
    enabled: true,
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
  });
  
  // Connection testing states
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

  const handleSaveApiSettings = () => {
    // In a real app, this would save to the server
    toast({
      title: "Settings saved",
      description: "API settings have been updated successfully.",
    });
    
    // Reset connection statuses after saving new credentials
    setSlackStatus(null);
    setOpenAIStatus(null);
  };

  const handleSaveEmailSettings = () => {
    // In a real app, this would save to the server
    toast({
      title: "Email settings saved",
      description: "Email settings have been updated successfully.",
    });
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
                <Input
                  id="slack-token"
                  type="password"
                  value={slackToken}
                  onChange={(e) => setSlackToken(e.target.value)}
                  placeholder="xoxb-your-slack-token"
                  className="focus-visible:ring-[#D2B48C]"
                />
                <div className="flex justify-between">
                  <p className="text-xs text-gray-500">
                    Used to connect to your Slack workspace and access channels
                  </p>
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
                <Input
                  id="openai-key"
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-your-openai-key"
                  className="focus-visible:ring-[#D2B48C]"
                />
                <div className="flex justify-between">
                  <p className="text-xs text-gray-500">
                    Required for AI responses and weekly summary generation
                  </p>
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
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveEmailSettings}
                disabled={!emailSettings.enabled}
                className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
              >
                Save Email Settings
              </Button>
            </CardFooter>
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
