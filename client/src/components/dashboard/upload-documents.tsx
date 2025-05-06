import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileUp, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";

interface UploadDocumentsProps {
  chatbotId: number;
}

export default function UploadDocuments({ chatbotId }: UploadDocumentsProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };
  
  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Create FormData
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      // Simulate upload progress (in a real app, you'd use a proper progress event)
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          const nextProgress = prev + 10;
          return nextProgress > 90 ? 90 : nextProgress;
        });
      }, 300);
      
      // Upload the file
      const response = await fetch(`/api/chatbots/${chatbotId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      clearInterval(interval);
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      setUploadProgress(100);
      
      // Show success message
      toast({
        title: "Document uploaded",
        description: `${selectedFile.name} has been uploaded successfully.`,
      });
      
      // Reset state and refresh document list
      setTimeout(() => {
        setSelectedFile(null);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        
        // Refresh document lists - both chatbot-specific list and global knowledge base list
        queryClient.invalidateQueries({ queryKey: [`/api/chatbots/${chatbotId}/documents`] });
        queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      }, 1000);
    } catch (error) {
      console.error("Failed to upload document", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="p-6 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="space-y-4">
        <div>
          <Label htmlFor="document-upload" className="text-sm font-medium">
            Upload Project Document
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            Upload PDF, TXT, or Excel files to provide knowledge to the chatbot.
          </p>
        </div>
        
        <div className="border-dashed border-2 border-gray-300 rounded-lg p-6 text-center">
          {selectedFile ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-[#D2B48C]" />
                <div className="ml-3 text-left">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearFile}
                className="text-gray-500 hover:text-gray-700"
                disabled={uploading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div>
              <input
                id="document-upload"
                type="file"
                accept=".pdf,.xls,.xlsx,.txt"
                onChange={handleFileChange}
                className="hidden"
                ref={fileInputRef}
              />
              <label
                htmlFor="document-upload"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <FileUp className="h-10 w-10 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700">
                  Click to upload
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  PDF, TXT, or Excel files only (max 10MB)
                </span>
              </label>
            </div>
          )}
        </div>
        
        {uploadProgress > 0 && (
          <Progress value={uploadProgress} className="h-2" />
        )}
        
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full bg-[#D2B48C] hover:bg-[#D2B48C]/90"
        >
          {uploading ? "Uploading..." : "Upload Document"}
        </Button>
      </div>
    </div>
  );
}
