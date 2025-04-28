import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import { ProtectedRoute } from "@/lib/protected-route";
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

// Component wrapper for pages that need to be inside SidebarLayout
function SidebarWrapper({ Component, ...props }: { Component: React.ComponentType<any>, [key: string]: any }) {
  return (
    <SidebarLayout>
      <Component {...props} />
    </SidebarLayout>
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
      
      {/* Protected routes with sidebar */}
      <ProtectedRoute 
        path="/" 
        component={() => (
          <Suspense fallback={<div>Loading...</div>}>
            <SidebarWrapper Component={Dashboard} />
          </Suspense>
        )} 
      />
      
      <ProtectedRoute 
        path="/chatbots" 
        component={() => (
          <Suspense fallback={<div>Loading...</div>}>
            <SidebarWrapper Component={Chatbots} />
          </Suspense>
        )} 
      />
      
      <Route path="/chatbot/:id">
        {({ id }) => (
          <ProtectedRoute 
            path={`/chatbot/${id}`}
            component={() => (
              <Suspense fallback={<div>Loading...</div>}>
                <SidebarWrapper Component={Chatbot} id={parseInt(id)} />
              </Suspense>
            )} 
          />
        )}
      </Route>
      
      <ProtectedRoute 
        path="/summaries" 
        component={() => (
          <Suspense fallback={<div>Loading...</div>}>
            <SidebarWrapper Component={Summaries} />
          </Suspense>
        )} 
      />
      
      <ProtectedRoute 
        path="/settings" 
        component={() => (
          <Suspense fallback={<div>Loading...</div>}>
            <SidebarWrapper Component={Settings} />
          </Suspense>
        )} 
      />
      
      <ProtectedRoute 
        path="/knowledge-base" 
        component={() => (
          <Suspense fallback={<div>Loading...</div>}>
            <SidebarWrapper Component={KnowledgeBase} />
          </Suspense>
        )} 
      />
      
      <ProtectedRoute 
        path="/users" 
        component={() => (
          <Suspense fallback={<div>Loading...</div>}>
            <SidebarWrapper Component={UsersPage} />
          </Suspense>
        )} 
      />
      
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
