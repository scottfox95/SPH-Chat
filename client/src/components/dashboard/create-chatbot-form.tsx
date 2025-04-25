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
import { apiRequest } from "@/lib/queryClient";
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
      
      let response;
      try {
        response = await fetch('/api/chatbots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include',
        });
        
        console.log("Raw response status:", response.status);
        // Get response headers in a compatible way
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        console.log("Raw response headers:", headers);
        
        // Check if the response is ok (status in the range 200-299)
        if (!response.ok) {
          // Try to get error details from the response
          let errorDetail = "";
          try {
            const errorData = await response.json();
            console.error("Error response data:", errorData);
            errorDetail = errorData.message || errorData.details || "";
          } catch {
            errorDetail = response.statusText;
          }
          
          throw new Error(`Server error (${response.status}): ${errorDetail}`);
        }
        
        const newChatbot = await response.json();
        console.log("Successfully created chatbot:", newChatbot);
        
        // Show success message
        toast({
          title: "Chatbot created",
          description: `${newChatbot.name} chatbot has been created successfully.`,
        });
        
        // Refresh chatbot list
        await queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
        
        // Navigate to the new chatbot using hard navigation
        window.location.href = `/chatbot/${newChatbot.id}`;
      } catch (fetchError) {
        console.error("Fetch error details:", fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error("Failed to create chatbot", error);
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
