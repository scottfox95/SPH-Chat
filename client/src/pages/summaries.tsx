import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Mail, Download, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";

export default function Summaries() {
  const [selectedChatbot, setSelectedChatbot] = useState<string>("");
  const [selectedSummary, setSelectedSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch chatbots
  const { data: chatbots = [] } = useQuery({
    queryKey: ["/api/chatbots"],
  });

  // Fetch summaries for selected chatbot
  const { data: summaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: [`/api/chatbots/${selectedChatbot}/summaries`],
    enabled: !!selectedChatbot,
  });

  // Filter summaries by search query
  const filteredSummaries = summaries.filter((summary: any) =>
    summary.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Weekly Summaries</h1>
            <p className="text-sm text-gray-500">View and manage project activity reports</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <Select value={selectedChatbot} onValueChange={setSelectedChatbot}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {chatbots.map((chatbot: any) => (
                <SelectItem key={chatbot.id} value={chatbot.id.toString()}>
                  {chatbot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search summaries..."
              className="pl-8 focus-visible:ring-[#D2B48C]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!selectedChatbot}
            />
          </div>
        </div>

        {!selectedChatbot ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Mail className="h-10 w-10 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium">Select a project</h3>
              <p className="text-sm text-gray-500 mt-1">
                Choose a project to view its weekly summaries
              </p>
            </CardContent>
          </Card>
        ) : summariesLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-6 w-6 border-2 border-[#D2B48C] border-t-transparent rounded-full"></div>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Calendar className="h-10 w-10 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium">No summaries found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery
                  ? "No summaries match your search query"
                  : "No weekly summaries have been generated yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSummaries.map((summary: any) => (
              <Card key={summary.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">
                    Week {summary.week}
                  </CardTitle>
                  <CardDescription>
                    Generated on {format(new Date(summary.sentAt), "MMMM d, yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-20 overflow-hidden text-sm text-gray-600 mb-4">
                    <div dangerouslySetInnerHTML={{ 
                      __html: summary.content.substring(0, 150) + "..." 
                    }} />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-[#D2B48C]"
                    onClick={() => setSelectedSummary(summary)}
                  >
                    View Summary
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Summary Detail Modal */}
      {selectedSummary && (
        <Dialog open={!!selectedSummary} onOpenChange={() => setSelectedSummary(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Week {selectedSummary.week} - {format(new Date(selectedSummary.sentAt), "MMMM d, yyyy")}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selectedSummary.content }} />
            </div>
            <div className="flex justify-end mt-6">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => {
                  // Create a download link for the HTML content
                  const blob = new Blob([selectedSummary.content], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `weekly-summary-${selectedSummary.week}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" />
                Download HTML
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
