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
    },
  });
  
  // Form submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      
      const response = await apiRequest("POST", "/api/chatbots", data);
      const newChatbot = await response.json();
      
      // Show success message
      toast({
        title: "Chatbot created",
        description: `${newChatbot.name} chatbot has been created successfully.`,
      });
      
      // Refresh chatbot list
      await queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      
      // Navigate to the new chatbot
      setLocation(`/chatbot/${newChatbot.id}`);
    } catch (error) {
      console.error("Failed to create chatbot", error);
      toast({
        title: "Creation failed",
        description: "Failed to create the chatbot. Please try again.",
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
