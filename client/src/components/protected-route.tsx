import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  path: string;
}

export function ProtectedRoute({
  component: Component,
  path
}: ProtectedRouteProps) {
  const { token, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!token || !user) {
    // Use hard redirect for authentication issues
    window.location.href = "/auth";
    return null;
  }

  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}