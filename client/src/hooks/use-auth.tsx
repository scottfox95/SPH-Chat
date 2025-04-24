import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

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
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
};

// Create context
const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isLoading: false,
  login: () => {},
  logout: () => {},
});

// Auth provider component with localStorage-based authentication
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("auth_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Load user data on initial render and token changes
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await fetch('/api/user', {
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          });
          
          if (response.ok) {
            const userData = await response.json();
            // Store the user data
            localStorage.setItem("auth_user", JSON.stringify(userData));
            setUser(userData);
          } else {
            // Token is invalid or expired
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          console.error("Auth check error:", error);
        }
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, [token]);

  // Login function - stores token and user data
  const login = (newToken: string, userData: User) => {
    localStorage.setItem("auth_token", newToken);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    
    toast({
      title: "Login successful",
      description: `Welcome, ${userData.displayName || userData.username}!`,
    });
    
    // Hard navigation to dashboard
    window.location.href = "/dashboard";
  };

  // Logout function - clears token and user data
  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      setToken(null);
      setUser(null);
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      
      // Hard navigation to login page
      window.location.href = "/auth";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
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
