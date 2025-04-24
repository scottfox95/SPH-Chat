import { useAuth } from "@/components/auth-provider";
import { Redirect } from "wouter";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Auth() {
  const { isAuthenticated, isLoading, login } = useAuth();
  
  // If already authenticated, redirect to home
  if (isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Handle login
  const handleLogin = async () => {
    try {
      // Use the login function from auth context
      const success = await login();
      
      if (success) {
        // Manually navigate to the root page if successful
        window.location.href = "/";
      } else {
        console.error("Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Sign In</h1>
          <p className="mt-2 text-gray-600">
            Use Replit authentication to access the dashboard
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <Button
            onClick={handleLogin}
            className="w-full flex items-center justify-center"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Login with Replit
          </Button>
        </div>
      </div>
    </div>
  );
}