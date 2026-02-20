import { useEffect } from 'react';

interface PerformanceMetrics {
  pageLoad?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
}

export function usePerformanceMonitor(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const metrics: PerformanceMetrics = {};

    // Navigation timing
    const navigationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const navEntry = entry as PerformanceNavigationTiming;
        const loadTime = navEntry.loadEventEnd - navEntry.startTime;
        metrics.pageLoad = loadTime;
        
        if (loadTime > 3000) {
          console.warn(`[Performance] Slow page load: ${loadTime.toFixed(0)}ms`);
        }
      }
    });

    // Paint timing (FCP)
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          metrics.firstContentfulPaint = entry.startTime;
          
          if (entry.startTime > 1800) {
            console.warn(`[Performance] Slow FCP: ${entry.startTime.toFixed(0)}ms`);
          }
        }
      }
    });

    // LCP
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      metrics.largestContentfulPaint = lastEntry.startTime;
      
      if (lastEntry.startTime > 2500) {
        console.warn(`[Performance] Slow LCP: ${lastEntry.startTime.toFixed(0)}ms`);
      }
    });

    // CLS
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      metrics.cumulativeLayoutShift = clsValue;
      
      if (clsValue > 0.1) {
        console.warn(`[Performance] High CLS: ${clsValue.toFixed(3)}`);
      }
    });

    // FID
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        metrics.firstInputDelay = entry.processingStart - entry.startTime;
        
        if (metrics.firstInputDelay > 100) {
          console.warn(`[Performance] Slow FID: ${metrics.firstInputDelay.toFixed(0)}ms`);
        }
      }
    });

    try {
      navigationObserver.observe({ entryTypes: ['navigation'] });
      paintObserver.observe({ entryTypes: ['paint'] });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // Some browsers don't support all entry types
    }

    // Log summary on page unload
    const logSummary = () => {
      if (Object.keys(metrics).length > 0) {
        console.info('[Performance Summary]', metrics);
      }
    };

    window.addEventListener('beforeunload', logSummary);

    return () => {
      navigationObserver.disconnect();
      paintObserver.disconnect();
      lcpObserver.disconnect();
      clsObserver.disconnect();
      fidObserver.disconnect();
      window.removeEventListener('beforeunload', logSummary);
    };
  }, [enabled]);
}
