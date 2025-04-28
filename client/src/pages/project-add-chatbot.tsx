import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "wouter";
import CreateChatbotForm from "@/components/dashboard/create-chatbot-form";

export default function ProjectAddChatbot() {
  const { id } = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  
  // Fetch project details to display in the header
  const { data: project = {}, isLoading } = useQuery({
    queryKey: [`/api/projects/${id}`],
  });
  
  const handleSuccess = () => {
    // Navigate back to the project page after successfully creating a chatbot
    setLocation(`/projects/${id}`);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/projects/${id}`}>{project.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>Add Chatbot</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Add Chatbot to {project.name}</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Create New Chatbot</CardTitle>
          <CardDescription>
            Add a new chatbot to the {project.name} project. This will create a new chatbot and automatically link it to this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateChatbotForm projectId={id} onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </div>
  );
}