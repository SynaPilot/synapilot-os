import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { OnboardingTour, useOnboarding } from '@/components/OnboardingTour';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { showTour, completeTour } = useOnboarding();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-6 max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
      <OnboardingTour run={showTour} onComplete={completeTour} />
    </SidebarProvider>
  );
}
