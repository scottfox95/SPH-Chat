import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDebugInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth-debug", {
        credentials: "include",
      });
      const data = await response.json();
      setDebugInfo(data);
    } catch (err) {
      setError("Failed to fetch debug info");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  const tryFetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/user", {
        credentials: "include",
      });
      const data = await response.json();
      console.log("User data:", data);
      alert(JSON.stringify(data, null, 2));
    } catch (err) {
      setError("Failed to fetch user");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Auth Debug Page</h1>
      
      <div className="grid gap-4 mb-6">
        <Button onClick={fetchDebugInfo} disabled={loading}>
          {loading ? "Loading..." : "Refresh Debug Info"}
        </Button>
        
        <Button onClick={tryFetchUser} disabled={loading} variant="outline">
          Test /api/user Endpoint
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {debugInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Authentication Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <strong>Is Authenticated:</strong> {debugInfo.isAuthenticated ? "Yes" : "No"}
              </div>
              
              <div>
                <strong>Session ID:</strong> {debugInfo.sessionID || "N/A"}
              </div>
              
              {debugInfo.user ? (
                <div>
                  <strong>User:</strong>
                  <pre className="bg-gray-100 p-2 rounded mt-1">
                    {JSON.stringify(debugInfo.user, null, 2)}
                  </pre>
                </div>
              ) : (
                <div>No user in session</div>
              )}
              
              <div>
                <strong>Session Data:</strong>
                <pre className="bg-gray-100 p-2 rounded mt-1">
                  {JSON.stringify(debugInfo.session, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}