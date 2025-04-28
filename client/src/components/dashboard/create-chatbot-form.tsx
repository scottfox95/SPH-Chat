import { useState, useEffect } from "react";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

// Form schema
const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  slackChannelId: z.string().min(1, "Slack channel ID is required"),
  asanaProjectId: z.string().optional(),
  projectId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateChatbotFormProps {
  projectId?: string;
}

export default function CreateChatbotForm({ projectId }: CreateChatbotFormProps = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  
  // Fetch projects for the dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });
  
  // Form definition
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slackChannelId: "",
      asanaProjectId: "",
      projectId: projectId || "",
    },
  });
  
  // Update projectId when the prop changes
  useEffect(() => {
    if (projectId) {
      form.setValue("projectId", projectId);
    }
  }, [projectId, form]);
  
  // Form submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      console.log("Submitting chatbot creation with data:", data);
      
      try {
        // Use the standardized apiRequest helper for consistency
        const response = await apiRequest('POST', '/api/chatbots', data);
        const newChatbot = await response.json();
        
        console.log("Successfully created chatbot:", newChatbot);
        
        // Show success message
        toast({
          title: "Chatbot created",
          description: `${newChatbot.name} chatbot has been created successfully.`,
        });
        
        // Refresh chatbot list
        await queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
        
        // Navigate to the new chatbot
        window.location.href = `/chatbot/${newChatbot.id}`;
      } catch (error) {
        console.error("Failed to create chatbot:", error);
        throw error;
      }
    } catch (error) {
      console.error("Chatbot creation failed", error);
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

        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Group (Optional)</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="focus-visible:ring-[#D2B48C]">
                    <SelectValue placeholder="Select a project group" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Group this chatbot within a specific project for better organization
              </FormDescription>
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
