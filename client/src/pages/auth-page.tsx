import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import AuthLayout from "@/components/layouts/auth-layout";
import LoginForm from "@/components/auth/login-form";
import RegisterForm from "@/components/auth/register-form";

type AuthView = "login" | "register";

export default function AuthPage() {
  const [view, setView] = useState<AuthView>("login");
  const { user, isLoading } = useAuth();
  const [_, navigate] = useLocation();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (user && !isLoading) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  // Toggle between login and register views
  const toggleView = () => {
    setView(view === "login" ? "register" : "login");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthLayout>
      {view === "login" ? (
        <LoginForm onSwitch={toggleView} />
      ) : (
        <RegisterForm onSwitch={toggleView} />
      )}
    </AuthLayout>
  );
}