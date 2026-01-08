import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { CommandMenu } from "@/components/CommandMenu";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load pages for code splitting
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Properties = lazy(() => import("./pages/Properties"));
const Deals = lazy(() => import("./pages/Deals"));
const Activities = lazy(() => import("./pages/Activities"));
const Stats = lazy(() => import("./pages/Stats"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}

// Root redirect component
function RootRedirect() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <PageLoader />;
  }
  
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect based on auth state */}
      <Route path="/" element={<RootRedirect />} />
      
      {/* Public route */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected routes - all wrapped with DashboardLayout via ProtectedRoute */}
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/leads" element={
        <ProtectedRoute><Leads /></ProtectedRoute>
      } />
      <Route path="/properties" element={
        <ProtectedRoute><Properties /></ProtectedRoute>
      } />
      <Route path="/deals" element={
        <ProtectedRoute><Deals /></ProtectedRoute>
      } />
      <Route path="/activities" element={
        <ProtectedRoute><Activities /></ProtectedRoute>
      } />
      <Route path="/stats" element={
        <ProtectedRoute><Stats /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><Settings /></ProtectedRoute>
      } />
      
      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
          {/* Global Command Menu - only visible when authenticated */}
          <CommandMenu />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
