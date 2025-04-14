import { createContext, useContext, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

// Auth context type
type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

// Default admin user
const defaultUser = {
  id: 1,
  username: "admin",
  displayName: "Administrator",
  initial: "A",
  role: "admin"
};

// Create context with a pre-authenticated user
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: true,
  isLoading: false,
  user: defaultUser,
  login: async () => true,
  logout: async () => {},
});

// Simplified Auth provider component for development without authentication
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Simplified login function - always succeeds
  const login = async (username: string, password: string) => {
    toast({
      title: "Login successful",
      description: `Welcome, Administrator!`,
    });
    return true;
  };

  // Simplified logout function - doesn't actually do anything
  const logout = async () => {
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: true,
        isLoading: false,
        user: defaultUser,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  return useContext(AuthContext);
}
