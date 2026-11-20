import { toGa4EventName } from '@/lib/telemetryCatalog';

/**
 * Safely tracks a custom event using Google Analytics 4 (gtag)
 * with a fallback log for development or offline environments.
 */
export const trackEvent = (eventName: string, params?: Record<string, any>, telemetryEnabled?: boolean) => {
  try {
    let isEnabled = telemetryEnabled;
    if (isEnabled === undefined) {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('productos_telemetry_enabled');
        isEnabled = stored === 'true';
      } else {
        isEnabled = false;
      }
    }

    const ga4EventName = toGa4EventName(eventName);
    if (isEnabled && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', ga4EventName, params);
      console.log(`[Telemetry] Tracked event "${ga4EventName}":`, params);
    } else {
      console.log(`[Telemetry Mock] Event "${ga4EventName}" would be tracked:`, params);
    }
  } catch (error) {
    console.error('[Telemetry Error] Failed to track event:', error);
  }
};
