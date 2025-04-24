import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { 
  useQuery, 
  useMutation,
  UseMutationResult,
  useQueryClient
} from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  username: string;
  displayName: string;
  initial: string;
  role: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterCredentials extends LoginCredentials {
  displayName: string;
  initial: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginCredentials>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterCredentials>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<User>({
    queryKey: ["/api/user"],
    enabled: true,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    throwOnError: false,
  });

  useEffect(() => {
    // After initial load, set loading to false
    if (!isLoading) {
      setIsInitialLoading(false);
    }
  }, [isLoading]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      console.log("Login attempt starting...");
      const res = await apiRequest("POST", "/api/login", credentials);
      const ok = res.ok;
      console.log("Login API response:", res.status, ok);
      if (!ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Login failed");
      }
      return await res.json();
    },
    onSuccess: async () => {
      const result = await refetch();
      console.log("Refetch result:", result.isSuccess, result.isError);
      if (result.isError) {
        // Try once more as sometimes the first refetch fails due to timing
        setTimeout(async () => {
          const retryResult = await refetch();
          console.log("Retry refetch result:", retryResult.isSuccess, retryResult.isError);
        }, 1500);
      }
      
      toast({
        title: "Login successful",
        description: "You have been logged in successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Login failed");
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterCredentials) => {
      const res = await apiRequest("POST", "/api/register", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Registration failed");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await refetch();
      toast({
        title: "Registration successful",
        description: "Your account has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Logout failed");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading: isInitialLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}