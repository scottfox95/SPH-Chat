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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

// Form schema
const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateProjectForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  
  // Form definition
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  // Form submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      console.log("Submitting project creation with data:", data);
      
      try {
        // Use the standardized apiRequest helper for consistency
        const response = await apiRequest('POST', '/api/projects', data);
        const newProject = await response.json();
        
        console.log("Successfully created project:", newProject);
        
        // Show success message
        toast({
          title: "Project created",
          description: `${newProject.name} project has been created successfully.`,
        });
        
        // Refresh project list
        await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        
        // Call the success callback if provided
        if (onSuccess) {
          onSuccess();
        }
        
        // Navigate to the projects page
        setLocation("/projects");
      } catch (error) {
        console.error("Failed to create project:", error);
        throw error;
      }
    } catch (error) {
      console.error("Project creation failed", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Creation failed",
        description: `Failed to create the project: ${errorMessage}`,
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
                  placeholder="Enter project name (e.g. Finance Team Chatbots)"
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter a description for this project"
                  {...field}
                  className="focus-visible:ring-[#D2B48C]"
                  rows={3}
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
          {isSubmitting ? "Creating..." : "Create Project"}
        </Button>
      </form>
    </Form>
  );
}