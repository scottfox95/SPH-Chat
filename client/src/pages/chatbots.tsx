import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Share2, MessageSquare } from "lucide-react";
import CreateChatbotForm from "@/components/dashboard/create-chatbot-form";
import ShareModal from "@/components/shared/share-modal";
import { format } from "date-fns";

export default function Chatbots() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState<any>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch chatbots
  const { data: chatbots = [], isLoading, error } = useQuery({
    queryKey: ["/api/chatbots"],
  });
  
  // Debug chatbots data
  console.log("Chatbots page data:", chatbots);
  console.log("Chatbots page error:", error);
  
  const handleShareClick = (chatbot: any) => {
    setSelectedChatbot(chatbot);
    setShareModalOpen(true);
  };
  
  // Filter chatbots by search query
  const filteredChatbots = chatbots.filter((chatbot: any) => 
    chatbot.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">All Chatbots</h1>
            <p className="text-sm text-gray-500">Manage your SPH ChatBot assistants</p>
          </div>
          <Button 
            onClick={() => setCreateModalOpen(true)}
            className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chatbot
          </Button>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search chatbots..."
              className="pl-8 focus-visible:ring-[#D2B48C]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Slack Channel</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredChatbots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    {searchQuery ? "No matching chatbots found." : "No chatbots created yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredChatbots.map((chatbot: any) => (
                  <TableRow key={chatbot.id}>
                    <TableCell className="font-medium">{chatbot.name}</TableCell>
                    <TableCell>
                      <Badge variant={chatbot.isActive ? "default" : "outline"} className={chatbot.isActive ? "bg-green-500" : ""}>
                        {chatbot.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 p-1 rounded">
                        {chatbot.slackChannelId}
                      </code>
                    </TableCell>
                    <TableCell>{format(new Date(chatbot.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShareClick(chatbot)}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Link href={`/chatbot/${chatbot.id}`}>
                          <Button size="sm" className="bg-[#D2B48C] hover:bg-[#D2B48C]/90">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
      
      {/* Create Chatbot Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New SPH ChatBot</DialogTitle>
          </DialogHeader>
          <CreateChatbotForm />
        </DialogContent>
      </Dialog>
      
      {/* Share Modal */}
      {selectedChatbot && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          chatbot={selectedChatbot}
        />
      )}
    </>
  );
}
