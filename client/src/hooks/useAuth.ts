// Re-export from auth-provider for backward compatibility
import { useAuth as useAuthProvider, type User } from "@/components/auth-provider";

export type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
};

export function useAuth(): AuthState {
  return useAuthProvider();
}