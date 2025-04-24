import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogIn } from "lucide-react";
import { Redirect } from "wouter";

export default function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Redirect to home if already logged in
  if (isAuthenticated && !isLoading) {
    return <Redirect to="/" />;
  }
  
  const handleLogin = () => {
    window.location.href = "/api/login";
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl w-full">
        {/* Left column: Login form */}
        <div className="flex flex-col justify-center">
          <Card className="w-full shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
              <CardDescription>
                Access the dashboard using Replit authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  You'll be redirected to the Replit authentication page to sign in securely.
                  No additional account creation is required.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleLogin}>
                <LogIn className="mr-2 h-4 w-4" />
                Login with Replit
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Right column: Hero section */}
        <div className="flex flex-col justify-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              SPH Chatbot Dashboard
            </h1>
            <p className="text-muted-foreground md:text-lg">
              Create AI-powered chatbots that integrate with your Asana projects and knowledge base.
              Configure, monitor, and manage all your bots from a single dashboard.
            </p>
            <ul className="space-y-2">
              <li className="flex items-start">
                <div className="rounded-full bg-primary/10 p-1 mr-2">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Multi-project Asana synchronization</span>
              </li>
              <li className="flex items-start">
                <div className="rounded-full bg-primary/10 p-1 mr-2">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Customizable chatbot configurations</span>
              </li>
              <li className="flex items-start">
                <div className="rounded-full bg-primary/10 p-1 mr-2">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Custom system prompts and knowledge bases</span>
              </li>
              <li className="flex items-start">
                <div className="rounded-full bg-primary/10 p-1 mr-2">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Slack integration for real-time notifications</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}