import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Copy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatbot: {
    id: number;
    name: string;
    publicToken: string;
    requireAuth: boolean;
  };
}

export default function ShareModal({ isOpen, onClose, chatbot }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [requireAuth, setRequireAuth] = useState(chatbot.requireAuth);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const shareUrl = `${window.location.origin}/bot/${chatbot.publicToken}`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const updateSettings = async () => {
    try {
      setIsSubmitting(true);
      
      await apiRequest("PUT", `/api/chatbots/${chatbot.id}`, {
        requireAuth,
      });
      
      // Invalidate cache to refresh data
      await queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      
      toast({
        title: "Settings updated",
        description: "Sharing settings have been updated successfully",
      });
      
      onClose();
    } catch (error) {
      console.error("Failed to update settings", error);
      toast({
        title: "Update failed",
        description: "Failed to update sharing settings",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this SPH ChatBot</DialogTitle>
          <DialogDescription>
            Anyone with this link can access this SPH ChatBot for {chatbot.name} project.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 mt-4">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="shareLink" className="sr-only">Link</Label>
            <Input
              id="shareLink"
              value={shareUrl}
              readOnly
              className="focus-visible:ring-[#D2B48C]"
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Access Settings</div>
          <div className="flex items-center space-x-2 mb-2">
            <Checkbox
              id="reqAuth"
              checked={requireAuth}
              onCheckedChange={(checked) => setRequireAuth(checked as boolean)}
              className="data-[state=checked]:bg-[#D2B48C] data-[state=checked]:border-[#D2B48C]"
            />
            <label
              htmlFor="reqAuth"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Require authentication
            </label>
          </div>
        </div>
        
        <DialogFooter className="sm:justify-between mt-4">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={updateSettings}
            className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
            disabled={isSubmitting}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
