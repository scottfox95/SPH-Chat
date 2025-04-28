import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { MessageSquare, Share2, Settings } from "lucide-react";
import { format } from "date-fns";

interface ChatbotCardProps {
  chatbot: {
    id: number;
    name: string;
    slackChannelId: string;
    isActive: boolean;
    publicToken: string;
    createdAt: string;
    projectId?: number | null;
    project?: {
      id: number;
      name: string;
    } | null;
  };
  onShare: () => void;
  projectNames?: Record<number, string>;
}

export default function ChatbotCard({ chatbot, onShare }: ChatbotCardProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{chatbot.name}</CardTitle>
            <CardDescription className="text-xs mt-1">
              Created {format(new Date(chatbot.createdAt), "MMM d, yyyy")}
            </CardDescription>
          </div>
          <Badge variant={chatbot.isActive ? "default" : "outline"} className={chatbot.isActive ? "bg-green-500" : ""}>
            {chatbot.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-500">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4" />
            <span className="truncate">Slack Channel: {chatbot.slackChannelId}</span>
          </div>
          <div className="text-xs mt-2">
            Public Link: <code className="text-xs bg-gray-100 p-1 rounded">.../{chatbot.publicToken}</code>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
        <Link href={`/chatbot/${chatbot.id}`}>
          <Button size="sm" className="bg-[#D2B48C] hover:bg-[#D2B48C]/90">
            <MessageSquare className="h-4 w-4 mr-2" />
            Open Chat
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
