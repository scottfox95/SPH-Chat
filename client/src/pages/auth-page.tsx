import { useAuth } from "@/components/auth-provider";
import { Redirect } from "wouter";
import { Loader2, LogIn, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthPage() {
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
    <div className="flex min-h-screen">
      {/* Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Welcome</h1>
            <p className="mt-2 text-gray-600">
              Sign in using Replit to access the dashboard
            </p>
          </div>
          
          <div className="mt-8 space-y-6">
            <Button
              onClick={handleLogin}
              className="w-full flex items-center justify-center py-6"
              size="lg"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Login with Replit
            </Button>
          </div>
          
          <div className="mt-6 text-center text-sm">
            <p className="text-gray-500">
              First time login will automatically create your account.
            </p>
          </div>
        </div>
      </div>
      
      {/* Hero Section */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary/20 to-primary/30 p-8 items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto w-24 h-24 mb-6 rounded-full bg-primary/20 flex items-center justify-center">
            <MessageSquare className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4">SPH ChatBot Platform</h2>
          <p className="text-lg mb-6">
            Build powerful AI-driven chatbots with advanced Asana project integration 
            and comprehensive knowledge management capabilities.
          </p>
          <div className="space-y-3 text-left">
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <p className="text-sm">Create custom chatbots configured for specific project types</p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <p className="text-sm">Connect to Asana projects and sync tasks automatically</p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <p className="text-sm">Manage knowledge bases and customize AI responses</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}