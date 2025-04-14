import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Trash2, FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import SidebarLayout from '@/components/layouts/sidebar-layout';

export default function KnowledgeBase() {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch all documents from all chatbots
  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    }
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Document deleted',
        description: 'The document has been removed from the knowledge base.',
      });
      setConfirmDeleteId(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete document',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    },
  });

  // Handle delete document
  const handleDeleteDocument = async (id: number) => {
    deleteDocumentMutation.mutate(id);
  };

  // Get file icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />;
    } else if (fileType.includes('excel') || fileType.includes('sheet')) {
      return <FileText className="h-5 w-5 text-green-500" />;
    } else if (fileType.includes('text/plain')) {
      return <FileText className="h-5 w-5 text-blue-500" />;
    } else {
      return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format date string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <SidebarLayout>
      <div className="container mx-auto py-6">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Knowledge Base</CardTitle>
            <CardDescription>
              Manage all documents uploaded to your chatbots
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : documents?.length === 0 ? (
              <div className="text-center py-12 border rounded-lg">
                <p className="text-muted-foreground mb-2">
                  No documents have been uploaded yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Upload documents to your chatbots to provide them with knowledge.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Chatbot</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents?.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          {getFileIcon(doc.fileType)}
                          <span className="ml-2">{doc.originalName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{doc.chatbotName}</TableCell>
                      <TableCell>{doc.fileType.split('/')[1]}</TableCell>
                      <TableCell>{formatDate(doc.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Delete Document Modal */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => confirmDeleteId && handleDeleteDocument(confirmDeleteId)}
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? "Deleting..." : "Delete Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}