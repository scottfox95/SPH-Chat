import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatbotProps {
  id: number;
  name: string;
  slackChannelId: string;
  projectId: number | null;
  isActive: boolean;
  createdAt: string;
}

interface ProjectProps {
  id: number;
  name: string;
}

interface ExistingChatbotsSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
}

export default function ExistingChatbotsSelector({
  isOpen,
  onClose,
  projectId,
  projectName,
}: ExistingChatbotsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatbots, setSelectedChatbots] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch all chatbots
  const { data: allChatbots = [], isLoading: isLoadingChatbots } = useQuery<ChatbotProps[]>({
    queryKey: ["/api/chatbots"],
  });

  // Fetch all projects for displaying project names
  const { data: projects = [] } = useQuery<ProjectProps[]>({
    queryKey: ["/api/projects"],
  });

  // Reset selected chatbots when the modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedChatbots([]);
      setSearchQuery("");
    }
  }, [isOpen]);

  // Filter chatbots that are not already assigned to this project
  const availableChatbots = allChatbots.filter(
    (chatbot) => chatbot.projectId !== projectId
  );

  // Filter chatbots based on search query
  const filteredChatbots = availableChatbots.filter((chatbot) =>
    chatbot.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get project name for a given project ID
  const getProjectName = (projectId: number | null) => {
    if (!projectId) return "Unassigned";
    const project = projects.find((p) => p.id === projectId);
    return project ? project.name : "Unknown Project";
  };

  // Toggle chatbot selection
  const toggleChatbotSelection = (chatbotId: number) => {
    setSelectedChatbots((prev) =>
      prev.includes(chatbotId)
        ? prev.filter((id) => id !== chatbotId)
        : [...prev, chatbotId]
    );
  };

  // Handle assignment of selected chatbots to the project
  const handleAssignChatbots = async () => {
    if (selectedChatbots.length === 0) {
      toast({
        title: "No chatbots selected",
        description: "Please select at least one chatbot to assign to this project.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create an array of promises for each chatbot update
      const updatePromises = selectedChatbots.map((chatbotId) =>
        apiRequest("PUT", `/api/chatbots/${chatbotId}`, {
          projectId: projectId,
        })
      );

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/chatbots`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });

      toast({
        title: "Chatbots assigned",
        description: `${selectedChatbots.length} chatbot${selectedChatbots.length > 1 ? "s" : ""} successfully assigned to ${projectName}.`,
      });

      // Close the modal
      onClose();
    } catch (error) {
      console.error("Failed to assign chatbots:", error);
      toast({
        title: "Assignment failed",
        description: "Failed to assign chatbots to this project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Existing Chatbots to {projectName}</DialogTitle>
          <DialogDescription>
            Select chatbots from other projects or unassigned chatbots to add to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4 mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search chatbots by name..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md">
          {isLoadingChatbots ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredChatbots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery
                ? "No chatbots match your search"
                : "No available chatbots to assign"}
            </div>
          ) : (
            <div className="divide-y">
              {filteredChatbots.map((chatbot) => (
                <div
                  key={chatbot.id}
                  className="flex items-center p-3 hover:bg-gray-50"
                >
                  <Checkbox
                    id={`chatbot-${chatbot.id}`}
                    checked={selectedChatbots.includes(chatbot.id)}
                    onCheckedChange={() => toggleChatbotSelection(chatbot.id)}
                    className="mr-3"
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={`chatbot-${chatbot.id}`}
                      className="flex flex-col cursor-pointer"
                    >
                      <span className="font-medium truncate">{chatbot.name}</span>
                      <span className="text-xs text-gray-500 truncate">
                        Slack Channel: {chatbot.slackChannelId}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        Currently in: {getProjectName(chatbot.projectId)}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <div className="flex justify-between w-full items-center">
            <div className="text-sm text-gray-500">
              {selectedChatbots.length} chatbot{selectedChatbots.length !== 1 ? "s" : ""} selected
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignChatbots}
                disabled={selectedChatbots.length === 0 || isSubmitting}
                className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Assign to Project
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}