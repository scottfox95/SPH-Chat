import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import AuthLayout from "@/components/layouts/auth-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

export default function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("login");

  // Redirect to home if already authenticated
  if (isAuthenticated && !isLoading) {
    navigate("/");
    return null;
  }

  return (
    <AuthLayout>
      <Tabs
        defaultValue="login"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <LoginForm onSuccess={() => navigate("/")} onRegisterClick={() => setActiveTab("register")} />
        </TabsContent>
        
        <TabsContent value="register">
          <RegisterForm onSuccess={() => navigate("/")} onLoginClick={() => setActiveTab("login")} />
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
}