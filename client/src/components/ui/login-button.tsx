import { Button } from "./button";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface LoginButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  showIcon?: boolean;
}

export function LoginButton({ 
  variant = "default", 
  size = "default",
  showIcon = true
}: LoginButtonProps) {
  const { user, isLoading } = useAuth();
  
  const handleLogin = () => {
    // Navigate to the login endpoint
    window.location.href = "/api/login";
  };
  
  const handleLogout = () => {
    // Navigate to the logout endpoint
    window.location.href = "/api/logout";
  };
  
  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        {showIcon && <div className="h-4 w-4 mr-2 animate-spin" />}
        Loading...
      </Button>
    );
  }
  
  if (user) {
    return (
      <Button 
        variant={variant} 
        size={size} 
        onClick={handleLogout}
      >
        {showIcon && <LogOut className="h-4 w-4 mr-2" />}
        Logout
      </Button>
    );
  }
  
  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleLogin}
    >
      {showIcon && <LogIn className="h-4 w-4 mr-2" />}
      Login
    </Button>
  );
}