import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

// Form schema
const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProjectEdit() {
  const params = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const projectId = parseInt(params.id);
  
  // Fetch project details
  const { 
    data: project, 
    isLoading,
    error
  } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
  });
  
  // Form definition
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  // Update form values when project data is loaded
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || "",
      });
    }
  }, [project, form]);
  
  // Handle back button
  const handleBack = () => {
    setLocation(`/projects/${projectId}`);
  };
  
  // Form submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      
      const response = await apiRequest('PUT', `/api/projects/${projectId}`, data);
      const updatedProject = await response.json();
      
      toast({
        title: "Project updated",
        description: `${updatedProject.name} has been updated successfully.`,
      });
      
      // Refresh project data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      // Navigate back to project detail
      setLocation(`/projects/${projectId}`);
    } catch (error) {
      console.error("Project update failed", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Update failed",
        description: `Failed to update the project: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // If the project doesn't exist or there's an error
  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-medium mb-2">Project not found</h2>
        <p className="text-gray-500 mb-4">The project you're trying to edit doesn't exist or you don't have permission to edit it.</p>
        <Button onClick={() => setLocation("/projects")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }
  
  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex items-center">
          <Button variant="ghost" onClick={handleBack} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Edit Project</h1>
            <p className="text-sm text-gray-500">
              {isLoading ? "Loading project details..." : `Editing ${project?.name}`}
            </p>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-[#D2B48C]" />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
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
                          placeholder="Enter project name"
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
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#D2B48C] hover:bg-[#D2B48C]/90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </main>
    </>
  );
}