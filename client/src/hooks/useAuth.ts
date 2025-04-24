import { useContext } from "react";
import { AuthContext, type User } from "@/components/auth-provider";

export type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
};

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}