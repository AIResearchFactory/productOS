/**
 * Safely tracks a custom event using Google Analytics 4 (gtag)
 * with a fallback log for development or offline environments.
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, params);
      console.log(`[Telemetry] Tracked event "${eventName}":`, params);
    } else {
      console.log(`[Telemetry Mock] Event "${eventName}" would be tracked:`, params);
    }
  } catch (error) {
    console.error('[Telemetry Error] Failed to track event:', error);
  }
};
