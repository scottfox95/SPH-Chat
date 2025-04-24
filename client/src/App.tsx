import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import SidebarLayout from "./components/layouts/sidebar-layout";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/protected-route";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Lazy loaded pages
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Chatbots = lazy(() => import("@/pages/chatbots"));
const Chatbot = lazy(() => import("@/pages/chatbot"));
const PublicChat = lazy(() => import("@/pages/public-chat"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const Summaries = lazy(() => import("@/pages/summaries"));
const Settings = lazy(() => import("@/pages/settings"));
const KnowledgeBase = lazy(() => import("@/pages/knowledge-base"));

function ProtectedSidebarRoute({ component: Component, ...rest }: { component: React.ComponentType<any>, path: string }) {
  return (
    <ProtectedRoute
      {...rest}
      component={(props: any) => (
        <SidebarLayout>
          <Suspense fallback={<div>Loading...</div>}>
            <Component {...props} />
          </Suspense>
        </SidebarLayout>
      )}
    />
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
      <ProtectedSidebarRoute path="/" component={Dashboard} />
      <ProtectedSidebarRoute path="/chatbots" component={Chatbots} />
      
      <Route
        path="/chatbot/:id"
        component={(props: { params: { id: string } }) => {
          const { user, isLoading } = useAuth();
          
          if (isLoading) {
            return (
              <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            );
          }
          
          if (!user) {
            return <Redirect to="/auth" />;
          }
          
          return (
            <SidebarLayout>
              <Suspense fallback={<div>Loading...</div>}>
                <Chatbot id={parseInt(props.params.id)} />
              </Suspense>
            </SidebarLayout>
          );
        }}
      />
      
      <ProtectedSidebarRoute path="/summaries" component={Summaries} />
      <ProtectedSidebarRoute path="/settings" component={Settings} />
      <ProtectedSidebarRoute path="/knowledge-base" component={KnowledgeBase} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
