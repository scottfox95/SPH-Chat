import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, emergencyApiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

// Form schema
const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  slackChannelId: z.string().min(1, "Slack channel ID is required"),
  asanaProjectId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateChatbotForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  
  // Form definition
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slackChannelId: "",
      asanaProjectId: "",
    },
  });
  
  // Form submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      console.log("Submitting chatbot creation with data:", data);
      
      // First try the normal API endpoint
      try {
        console.log("Attempting chatbot creation via standard API...");
        const response = await fetch('/api/chatbots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include',
        });
        
        console.log("Standard API response status:", response.status);
        
        // If the response is ok, process it as normal
        if (response.ok) {
          const newChatbot = await response.json();
          console.log("Successfully created chatbot via standard API:", newChatbot);
          
          // Show success message
          toast({
            title: "Chatbot created",
            description: `${newChatbot.name} chatbot has been created successfully.`,
          });
          
          // Refresh chatbot list
          await queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
          
          // Navigate to the new chatbot
          window.location.href = `/chatbot/${newChatbot.id}`;
          return;
        }
        
        // If we're here, the standard API failed - get error details
        let errorDetail = "";
        try {
          const errorData = await response.json();
          console.error("Error response data:", errorData);
          errorDetail = errorData.message || errorData.details || "";
        } catch {
          errorDetail = response.statusText;
        }
        
        // Throw error to trigger emergency API attempt
        console.warn(`Standard API failed with ${response.status}: ${errorDetail}`);
        throw new Error(`Server error (${response.status}): ${errorDetail}`);
      } catch (standardApiError) {
        console.warn("Standard API attempt failed, trying emergency API...", standardApiError);
        
        // If the standard API failed, try the emergency API
        try {
          console.log("Attempting emergency chatbot creation...");
          
          // Set up database if needed
          try {
            const setupResponse = await emergencyApiRequest('POST', 'setup', {});
            console.log("Emergency setup response:", await setupResponse.json());
          } catch (setupError) {
            console.warn("Emergency setup failed but continuing:", setupError);
          }
          
          // Create chatbot using emergency API
          const emergencyResponse = await emergencyApiRequest('POST', 'chatbot', {
            name: data.name,
            slackChannelId: data.slackChannelId
          });
          
          const newChatbot = await emergencyResponse.json();
          console.log("Successfully created chatbot via emergency API:", newChatbot);
          
          // Show success message with emergency note
          toast({
            title: "Chatbot created",
            description: `${newChatbot.name} chatbot has been created using emergency mode.`,
          });
          
          // Refresh chatbot list (try both endpoints)
          try {
            await queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
          } catch (e) {
            console.warn("Failed to invalidate standard API cache:", e);
          }
          
          try {
            await emergencyApiRequest('GET', 'chatbots', {});
          } catch (e) {
            console.warn("Failed to fetch emergency chatbots:", e);
          }
          
          // Show success message for potential next steps
          toast({
            title: "Important",
            description: "Emergency mode used - some chatbot features may be limited. Contact support if issues persist.",
            duration: 8000,
          });
          
          // Navigate to the dashboard instead of the chatbot detail page
          // since the emergency chatbot might have different structure
          window.location.href = '/';
          return;
        } catch (emergencyError) {
          console.error("Emergency API also failed:", emergencyError);
          throw emergencyError;
        }
      }
    } catch (error) {
      console.error("All attempts to create chatbot failed", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Creation failed",
        description: `Failed to create the chatbot: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter project name (e.g. 123 Main Street)"
                  {...field}
                  className="focus-visible:ring-[#D2B48C]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="slackChannelId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slack Channel ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter Slack channel ID (e.g. C12345678)"
                  {...field}
                  className="focus-visible:ring-[#D2B48C]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="asanaProjectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asana Project ID (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter Asana project ID (e.g. 1234567890123456)"
                  {...field}
                  className="focus-visible:ring-[#D2B48C]"
                />
              </FormControl>
              <p className="text-xs text-gray-500">
                Link this chatbot to an Asana project to include tasks in responses
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button
          type="submit"
          className="w-full bg-[#D2B48C] hover:bg-[#D2B48C]/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create New Chatbot"}
        </Button>
      </form>
    </Form>
  );
}
