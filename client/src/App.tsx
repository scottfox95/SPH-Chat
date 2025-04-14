import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "./hooks/use-auth";
import { Suspense, lazy, useEffect } from "react";
import SidebarLayout from "./components/layouts/sidebar-layout";
import AuthLayout from "./components/layouts/auth-layout";
import NotFound from "@/pages/not-found";

// Lazy loaded pages
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Chatbots = lazy(() => import("@/pages/chatbots"));
const Chatbot = lazy(() => import("@/pages/chatbot"));
const PublicChat = lazy(() => import("@/pages/public-chat"));
const Login = lazy(() => import("@/pages/login"));
const Summaries = lazy(() => import("@/pages/summaries"));
const Settings = lazy(() => import("@/pages/settings"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !location.includes("/bot/") && location !== "/login") {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/bot/:token">
        <Suspense fallback={<div>Loading...</div>}>
          <PublicChat />
        </Suspense>
      </Route>
      
      <Route path="/login">
        <AuthLayout>
          <Suspense fallback={<div>Loading...</div>}>
            <Login />
          </Suspense>
        </AuthLayout>
      </Route>
      
      {/* Protected routes */}
      <Route path="/">
        {isAuthenticated ? (
          <SidebarLayout>
            <Suspense fallback={<div>Loading...</div>}>
              <Dashboard />
            </Suspense>
          </SidebarLayout>
        ) : (
          <AuthLayout>
            <Suspense fallback={<div>Loading...</div>}>
              <Login />
            </Suspense>
          </AuthLayout>
        )}
      </Route>
      
      <Route path="/chatbots">
        {isAuthenticated ? (
          <SidebarLayout>
            <Suspense fallback={<div>Loading...</div>}>
              <Chatbots />
            </Suspense>
          </SidebarLayout>
        ) : null}
      </Route>
      
      <Route path="/chatbot/:id">
        {({ id }) => (
          isAuthenticated ? (
            <SidebarLayout>
              <Suspense fallback={<div>Loading...</div>}>
                <Chatbot id={parseInt(id)} />
              </Suspense>
            </SidebarLayout>
          ) : null
        )}
      </Route>
      
      <Route path="/summaries">
        {isAuthenticated ? (
          <SidebarLayout>
            <Suspense fallback={<div>Loading...</div>}>
              <Summaries />
            </Suspense>
          </SidebarLayout>
        ) : null}
      </Route>
      
      <Route path="/settings">
        {isAuthenticated ? (
          <SidebarLayout>
            <Suspense fallback={<div>Loading...</div>}>
              <Settings />
            </Suspense>
          </SidebarLayout>
        ) : null}
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
