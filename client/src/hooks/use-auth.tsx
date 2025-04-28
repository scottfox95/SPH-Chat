import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";

// User type definition based on the schema
interface User {
  id: number;
  username: string;
  displayName: string;
  initial: string;
  role: string;
}

interface Credentials {
  username: string;
  password: string;
}

interface RegisterData extends Credentials {
  displayName: string;
  initial: string;
  role?: string;
}

// Auth context type
type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<boolean>;
};

// Create auth context
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: async () => false,
  logout: async () => {},
  register: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [initialized, setInitialized] = useState(false);

  // Fetch current user data
  const { 
    data: user,
    isLoading,
    error,
    refetch
  } = useQuery<User | null>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        console.error('Failed to fetch user:', error);
        return null;
      }
    },
    enabled: initialized,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Initialize auth state on mount
  useEffect(() => {
    setInitialized(true);
  }, []);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: Credentials) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      
      return await response.json();
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(['/api/auth/me'], userData);
      toast({
        title: 'Login successful',
        description: `Welcome, ${userData.displayName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/auth/me'], null);
      toast({
        title: 'Logged out',
        description: 'You have been logged out successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Logout failed',
        description: 'An error occurred during logout',
        variant: 'destructive',
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }
      
      return await response.json();
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(['/api/auth/me'], userData);
      toast({
        title: 'Registration successful',
        description: `Welcome, ${userData.displayName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Login handler
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      await loginMutation.mutateAsync({ username, password });
      return true;
    } catch (error) {
      return false;
    }
  };

  // Logout handler
  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  // Register handler
  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      await registerMutation.mutateAsync(data);
      return true;
    } catch (error) {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        isLoading: isLoading || loginMutation.isPending || logoutMutation.isPending,
        user,
        login,
        logout,
        register,
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
