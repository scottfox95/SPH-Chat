import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { user, isLoading } = useAuth();

  // If the user is already logged in, redirect to home
  if (user && !isLoading) {
    return <Redirect to="/" />;
  }

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl bg-[#D2B48C] flex items-center justify-center">
              <span className="text-white font-semibold text-lg">SPH</span>
            </div>
            <span className="ml-3 text-xl font-semibold text-gray-900">SPH ChatBot</span>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold">Login</CardTitle>
            <CardDescription>
              Sign in to access the ChatBot dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-[#D2B48C]" />
              </div>
            ) : (
              <Button
                onClick={handleLogin}
                className="w-full bg-[#D2B48C] hover:bg-[#D2B48C]/90"
              >
                Sign in with Replit
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}