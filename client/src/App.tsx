import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import SidebarLayout from "./components/layouts/sidebar-layout";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
      
      <ProtectedRoute
        path="/chatbot/:id"
        component={(params: { id: string }) => (
          <SidebarLayout>
            <Suspense fallback={<div>Loading...</div>}>
              <Chatbot id={parseInt(params.id)} />
            </Suspense>
          </SidebarLayout>
        )}
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
