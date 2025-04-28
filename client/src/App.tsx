import { Switch, Route, Redirect, useRoute } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import SidebarLayout from "./components/layouts/sidebar-layout";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/protected-route";
import { QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

// Lazy loaded pages
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Chatbots = lazy(() => import("@/pages/chatbots"));
const Chatbot = lazy(() => import("@/pages/chatbot"));
const PublicChat = lazy(() => import("@/pages/public-chat"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const Summaries = lazy(() => import("@/pages/summaries"));
const Settings = lazy(() => import("@/pages/settings"));
const KnowledgeBase = lazy(() => import("@/pages/knowledge-base"));
const UserManagement = lazy(() => import("@/pages/user-management"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const ProjectEdit = lazy(() => import("@/pages/project-edit"));
const ProjectAddChatbot = lazy(() => import("@/pages/project-add-chatbot"));

function ProtectedSidebarRoute({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { token, user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }
  
  if (!token || !user) {
    // Use hard redirect for authentication issues
    window.location.href = "/auth";
    return null;
  }
  
  return (
    <Route path={path}>
      <SidebarLayout>
        <Suspense fallback={<div>Loading...</div>}>
          <Component />
        </Suspense>
      </SidebarLayout>
    </Route>
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
      <ProtectedSidebarRoute path="/dashboard" component={Dashboard} />
      <ProtectedSidebarRoute path="/chatbots" component={Chatbots} />
      
      <Route path="/chatbot/:id">
        {(params) => {
          const { token, user, isLoading } = useAuth();
          
          if (isLoading) {
            return (
              <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            );
          }
          
          if (!token || !user) {
            // Use hard redirect for authentication issues
            window.location.href = "/auth";
            return null;
          }
          
          return (
            <SidebarLayout>
              <Suspense fallback={<div>Loading...</div>}>
                <Chatbot id={parseInt(params.id)} />
              </Suspense>
            </SidebarLayout>
          );
        }}
      </Route>
      
      <ProtectedSidebarRoute path="/summaries" component={Summaries} />
      <ProtectedSidebarRoute path="/settings" component={Settings} />
      <ProtectedSidebarRoute path="/knowledge-base" component={KnowledgeBase} />
      <ProtectedSidebarRoute path="/users" component={UserManagement} />
      <ProtectedSidebarRoute path="/projects" component={Projects} />
      
      {/* Project route with ID parameter */}
      <Route path="/projects/:id">
        {(params) => {
          const { token, user, isLoading } = useAuth();
          
          if (isLoading) {
            return (
              <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            );
          }
          
          if (!token || !user) {
            window.location.href = "/auth";
            return null;
          }
          
          return (
            <SidebarLayout>
              <Suspense fallback={<div>Loading...</div>}>
                <ProjectDetail />
              </Suspense>
            </SidebarLayout>
          );
        }}
      </Route>
      
      {/* Project edit route */}
      <Route path="/projects/:id/edit">
        {(params) => {
          const { token, user, isLoading } = useAuth();
          
          if (isLoading) {
            return (
              <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            );
          }
          
          if (!token || !user) {
            window.location.href = "/auth";
            return null;
          }
          
          return (
            <SidebarLayout>
              <Suspense fallback={<div>Loading...</div>}>
                <ProjectEdit />
              </Suspense>
            </SidebarLayout>
          );
        }}
      </Route>
      
      {/* Project add chatbot route */}
      <Route path="/projects/:id/new-chatbot">
        {(params) => {
          const { token, user, isLoading } = useAuth();
          
          if (isLoading) {
            return (
              <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            );
          }
          
          if (!token || !user) {
            window.location.href = "/auth";
            return null;
          }
          
          return (
            <SidebarLayout>
              <Suspense fallback={<div>Loading...</div>}>
                <ProjectAddChatbot />
              </Suspense>
            </SidebarLayout>
          );
        }}
      </Route>
      
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
