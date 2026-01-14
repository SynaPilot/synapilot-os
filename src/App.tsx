import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { CommandMenu } from "@/components/CommandMenu";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { EasterEgg } from "@/components/EasterEgg";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Lazy load pages for code splitting
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactDetail = lazy(() => import("./pages/ContactDetail"));
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
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4"
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Chargement...</p>
      </motion.div>
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
      <Route path="/contacts" element={
        <ProtectedRoute><Contacts /></ProtectedRoute>
      } />
      <Route path="/contacts/:id" element={
        <ProtectedRoute><ContactDetail /></ProtectedRoute>
      } />
      {/* Keep /leads as alias for backwards compatibility */}
      <Route path="/leads" element={
        <ProtectedRoute><Contacts /></ProtectedRoute>
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

function AppWithMonitoring() {
  // Enable performance monitoring in production
  usePerformanceMonitor(import.meta.env.PROD);
  
  return (
    <>
      <OfflineIndicator />
      <EasterEgg />
      <Toaster />
      <Sonner 
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(9, 9, 11, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white'
          },
          className: 'backdrop-blur-sm'
        }}
      />
      <BrowserRouter>
        <AnimatePresence mode="wait">
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
        </AnimatePresence>
        {/* Global Command Menu - only visible when authenticated */}
        <CommandMenu />
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppWithMonitoring />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
