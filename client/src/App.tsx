import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import SidebarLayout from "./components/layouts/sidebar-layout";
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
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/bot/:token">
        <Suspense fallback={<div>Loading...</div>}>
          <PublicChat />
        </Suspense>
      </Route>
      
      {/* Dashboard as the default route */}
      <Route path="/">
        <SidebarLayout>
          <Suspense fallback={<div>Loading...</div>}>
            <Dashboard />
          </Suspense>
        </SidebarLayout>
      </Route>
      
      <Route path="/chatbots">
        <SidebarLayout>
          <Suspense fallback={<div>Loading...</div>}>
            <Chatbots />
          </Suspense>
        </SidebarLayout>
      </Route>
      
      <Route path="/chatbot/:id">
        {({ id }) => (
          <SidebarLayout>
            <Suspense fallback={<div>Loading...</div>}>
              <Chatbot id={parseInt(id)} />
            </Suspense>
          </SidebarLayout>
        )}
      </Route>
      
      <Route path="/summaries">
        <SidebarLayout>
          <Suspense fallback={<div>Loading...</div>}>
            <Summaries />
          </Suspense>
        </SidebarLayout>
      </Route>
      
      <Route path="/settings">
        <SidebarLayout>
          <Suspense fallback={<div>Loading...</div>}>
            <Settings />
          </Suspense>
        </SidebarLayout>
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
