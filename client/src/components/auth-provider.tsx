import { createContext, ReactNode, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

// Auth user type
export type User = {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  profileImageUrl?: string;
};

// Auth context type
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  login: () => Promise<boolean>;
};

// Create auth context
export const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const {
    data: authStatus,
    error,
    isLoading,
    refetch,
  } = useQuery<{ isAuthenticated: boolean; userInfo?: User }>({
    queryKey: ["/api/auth/status"],
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 1, // Try once more in case of initial failure
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });
  
  // Extract user from auth status
  const user = authStatus?.isAuthenticated ? authStatus.userInfo || null : null;
  
  // Add a login function to be used by auth pages
  const login = async () => {
    try {
      console.log("Login attempt starting...");
      
      // Call the login API
      const response = await fetch("/api/login", {
        method: "GET",
        credentials: "include",
      });
      
      console.log("Login API response:", response.status, response.redirected);
      
      // If login appears successful
      if (response.ok || response.redirected) {
        // Force refetch user data
        const result = await refetch();
        console.log("Refetch result:", result.isSuccess, !!result.data);
        
        // If we now have user data after refetch, success!
        if (result.isSuccess && result.data) {
          console.log("Login successful, user data received");
          return true;
        }
        
        // If we don't have user data yet, try one more time after a short delay
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryResult = await refetch();
        console.log("Retry refetch result:", retryResult.isSuccess, !!retryResult.data);
        
        // Return final authentication state
        return retryResult.isSuccess && !!retryResult.data;
      }
      
      console.log("Login failed");
      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isAuthenticated: !!user,
        error: error || null,
        login,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Auth hook
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}