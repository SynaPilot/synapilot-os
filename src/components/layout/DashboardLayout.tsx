import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { OnboardingTour, useOnboarding } from '@/components/OnboardingTour';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { showTour, completeTour } = useOnboarding();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:flex">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            {/* Add padding-bottom on mobile for the bottom nav */}
            <div className="p-4 md:p-6 max-w-full pb-24 md:pb-6">
              {children}
            </div>
          </main>
        </div>
      </div>
      {/* Mobile Bottom Navigation - hidden on desktop */}
      <MobileBottomNav />
      <OnboardingTour run={showTour} onComplete={completeTour} />
    </SidebarProvider>
  );
}
