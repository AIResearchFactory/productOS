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

    if (isEnabled && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, params);
      console.log(`[Telemetry] Tracked event "${eventName}":`, params);
    } else {
      console.log(`[Telemetry Mock] Event "${eventName}" would be tracked:`, params);
    }
  } catch (error) {
    console.error('[Telemetry Error] Failed to track event:', error);
  }
};
