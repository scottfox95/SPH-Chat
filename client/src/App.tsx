import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import SidebarLayout from "./components/layouts/sidebar-layout";
import NotFound from "@/pages/not-found";

// Lazy loaded pages
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Chatbots = lazy(() => import("@/pages/chatbots"));
const Chatbot = lazy(() => import("@/pages/chatbot"));
const PublicChat = lazy(() => import("@/pages/public-chat"));
const Summaries = lazy(() => import("@/pages/summaries"));
const Settings = lazy(() => import("@/pages/settings"));
const KnowledgeBase = lazy(() => import("@/pages/knowledge-base"));
const UsersPage = lazy(() => import("@/pages/users-page"));
const AuthPage = lazy(() => import("@/pages/auth-page"));

// Protected Route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [_, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  return <>{children}</>;
}

// Protected Sidebar Route
function ProtectedSidebarRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <SidebarLayout>{children}</SidebarLayout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/bot/:token">
        <Suspense fallback={<div>Loading...</div>}>
          <PublicChat />
        </Suspense>
      </Route>

      <Route path="/auth">
        <Suspense fallback={<div>Loading...</div>}>
          <AuthPage />
        </Suspense>
      </Route>
      
      {/* Protected routes */}
      <Route path="/">
        <ProtectedSidebarRoute>
          <Suspense fallback={<div>Loading...</div>}>
            <Dashboard />
          </Suspense>
        </ProtectedSidebarRoute>
      </Route>
      
      <Route path="/chatbots">
        <ProtectedSidebarRoute>
          <Suspense fallback={<div>Loading...</div>}>
            <Chatbots />
          </Suspense>
        </ProtectedSidebarRoute>
      </Route>
      
      <Route path="/chatbot/:id">
        {({ id }) => (
          <ProtectedSidebarRoute>
            <Suspense fallback={<div>Loading...</div>}>
              <Chatbot id={parseInt(id)} />
            </Suspense>
          </ProtectedSidebarRoute>
        )}
      </Route>
      
      <Route path="/summaries">
        <ProtectedSidebarRoute>
          <Suspense fallback={<div>Loading...</div>}>
            <Summaries />
          </Suspense>
        </ProtectedSidebarRoute>
      </Route>
      
      <Route path="/settings">
        <ProtectedSidebarRoute>
          <Suspense fallback={<div>Loading...</div>}>
            <Settings />
          </Suspense>
        </ProtectedSidebarRoute>
      </Route>
      
      <Route path="/knowledge-base">
        <ProtectedSidebarRoute>
          <Suspense fallback={<div>Loading...</div>}>
            <KnowledgeBase />
          </Suspense>
        </ProtectedSidebarRoute>
      </Route>
      
      <Route path="/users">
        <ProtectedSidebarRoute>
          <Suspense fallback={<div>Loading...</div>}>
            <UsersPage />
          </Suspense>
        </ProtectedSidebarRoute>
      </Route>
      
      {/* Fallback to 404 */}
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <>
      <Router />
      <Toaster />
    </>
  );
}

export default App;
