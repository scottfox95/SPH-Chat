import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Folder, FileText, MoreHorizontal, FolderPlus } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectCardProps {
  project: {
    id: number;
    name: string;
    description: string | null;
    createdById: number;
    createdAt: string;
  };
  chatbotCount?: number;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
}

export default function ProjectCard({ 
  project, 
  chatbotCount = 0, 
  onEditClick, 
  onDeleteClick 
}: ProjectCardProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <CardDescription className="text-xs mt-1">
              Created {format(new Date(project.createdAt), "MMM d, yyyy")}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEditClick && (
                <DropdownMenuItem onClick={onEditClick}>
                  Edit Project
                </DropdownMenuItem>
              )}
              {onDeleteClick && (
                <DropdownMenuItem 
                  onClick={onDeleteClick}
                  className="text-red-500 focus:text-red-500"
                >
                  Delete Project
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-500">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4" />
            <span className="text-gray-700">
              {chatbotCount} {chatbotCount === 1 ? 'Chatbot' : 'Chatbots'}
            </span>
          </div>
          <p className="text-sm line-clamp-2 mt-2">
            {project.description || "No description provided"}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Link href={`/projects/${project.id}`}>
          <Button variant="outline" size="sm">
            <Folder className="h-4 w-4 mr-2" />
            View Project
          </Button>
        </Link>
        <Link href={`/projects/${project.id}/new-chatbot`}>
          <Button size="sm" className="bg-[#D2B48C] hover:bg-[#D2B48C]/90">
            <FolderPlus className="h-4 w-4 mr-2" />
            Add Chatbot
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}