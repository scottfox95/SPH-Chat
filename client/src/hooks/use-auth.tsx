import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/queryClient";
import { useLocation } from "wouter";

// User type
interface User {
  id: number;
  username: string;
  displayName: string;
  initial: string;
  role: string;
}

// Auth context type
type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

// Create context
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: async () => false,
  register: async () => false,
  logout: async () => {},
});

// Auth provider component with actual authentication
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Fetch the user data if logged in
  const { 
    data: userData, 
    isLoading, 
    error 
  } = useQuery<User>({ 
    queryKey: ['/api/user'],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Handle undefined user data (convert to null)
  const user = userData || null;

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await apiRequest('POST', '/api/login', credentials);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
      
      return await response.json();
    },
    onSuccess: (userData: User) => {
      // Update the user in the cache
      queryClient.setQueryData(['/api/user'], userData);
      
      toast({
        title: "Login successful",
        description: `Welcome, ${userData.displayName || userData.username}!`,
      });
      
      console.log("Login successful - redirecting to homepage");
      
      // Redirect to dashboard - using timeout to ensure state updates first
      setTimeout(() => {
        setLocation("/");
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; displayName: string; initial?: string }) => {
      // If no initial is provided, create one from the display name
      if (!data.initial && data.displayName) {
        // Get initials from each word in display name (up to 2 characters)
        const words = data.displayName.split(' ');
        if (words.length > 1) {
          data.initial = (words[0][0] + words[1][0]).toUpperCase();
        } else {
          data.initial = data.displayName.substring(0, 2).toUpperCase();
        }
      }
      
      const response = await apiRequest('POST', '/api/register', data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      
      return await response.json();
    },
    onSuccess: (userData: User) => {
      // Update the user in the cache
      queryClient.setQueryData(['/api/user'], userData);
      
      toast({
        title: "Registration successful",
        description: `Welcome, ${userData.displayName || userData.username}!`,
      });
      
      console.log("Registration successful - redirecting to homepage");
      
      // Redirect to dashboard - using timeout to ensure state updates first
      setTimeout(() => {
        setLocation("/");
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Logout function
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/logout');
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: () => {
      // Remove user from cache
      queryClient.setQueryData(['/api/user'], null);
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      
      // Redirect to login page
      setLocation("/auth");
    },
    onError: () => {
      toast({
        title: "Logout failed",
        description: "There was an error logging out",
        variant: "destructive",
      });
    }
  });

  // Login function
  const login = async (username: string, password: string) => {
    try {
      await loginMutation.mutateAsync({ username, password });
      return true;
    } catch (error) {
      return false;
    }
  };

  // Register function
  const register = async (username: string, password: string, displayName: string) => {
    try {
      await registerMutation.mutateAsync({ username, password, displayName });
      return true;
    } catch (error) {
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        isLoading: isLoading && !error,
        user,
        login,
        register,
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
