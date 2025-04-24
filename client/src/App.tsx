import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import SidebarLayout from "./components/layouts/sidebar-layout";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "./components/protected-route";

// Lazy loaded pages
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Chatbots = lazy(() => import("@/pages/chatbots"));
const Chatbot = lazy(() => import("@/pages/chatbot"));
const PublicChat = lazy(() => import("@/pages/public-chat"));
const Auth = lazy(() => import("@/pages/auth"));
const Summaries = lazy(() => import("@/pages/summaries"));
const Settings = lazy(() => import("@/pages/settings"));
const KnowledgeBase = lazy(() => import("@/pages/knowledge-base"));

// Wrapped components for protected routes
const ProtectedDashboard = () => (
  <SidebarLayout>
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  </SidebarLayout>
);

const ProtectedChatbots = () => (
  <SidebarLayout>
    <Suspense fallback={<div>Loading...</div>}>
      <Chatbots />
    </Suspense>
  </SidebarLayout>
);

const ProtectedChatbotDetails = ({ id }: { id: number }) => (
  <SidebarLayout>
    <Suspense fallback={<div>Loading...</div>}>
      <Chatbot id={id} />
    </Suspense>
  </SidebarLayout>
);

const ProtectedSummaries = () => (
  <SidebarLayout>
    <Suspense fallback={<div>Loading...</div>}>
      <Summaries />
    </Suspense>
  </SidebarLayout>
);

const ProtectedSettings = () => (
  <SidebarLayout>
    <Suspense fallback={<div>Loading...</div>}>
      <Settings />
    </Suspense>
  </SidebarLayout>
);

const ProtectedKnowledgeBase = () => (
  <SidebarLayout>
    <Suspense fallback={<div>Loading...</div>}>
      <KnowledgeBase />
    </Suspense>
  </SidebarLayout>
);

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
          <Auth />
        </Suspense>
      </Route>
      
      {/* Protected routes */}
      <ProtectedRoute path="/" component={ProtectedDashboard} />
      <ProtectedRoute path="/chatbots" component={ProtectedChatbots} />
      
      <Route path="/chatbot/:id">
        {({ id }) => (
          <ProtectedRoute 
            path={`/chatbot/${id}`} 
            component={() => <ProtectedChatbotDetails id={parseInt(id)} />} 
          />
        )}
      </Route>
      
      <ProtectedRoute path="/summaries" component={ProtectedSummaries} />
      <ProtectedRoute path="/settings" component={ProtectedSettings} />
      <ProtectedRoute path="/knowledge-base" component={ProtectedKnowledgeBase} />
      
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
