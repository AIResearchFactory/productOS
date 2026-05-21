import { lazy, Suspense, useState, useEffect } from 'react';
import ReactGA from 'react-ga4';
import { appApi } from './api/app';
import { runtimeApi } from './api/runtime';
import { Toaster } from './components/ui/toaster';
import { DropdownMenuProvider } from './components/ui/dropdown-menu';
import Logo from '@/components/ui/Logo';
import { checkServerHealth } from '@/api/server';
import ServerOfflineOverlay from '@/components/workspace/ServerOfflineOverlay';

const Workspace = lazy(() => import('./pages/Workspace'));
const InstallationWizard = lazy(() => import('./components/Installation/InstallationWizard'));

function AppBootSplash() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="text-center animate-pulse flex flex-col items-center gap-4">
        <Logo size="md" />
        <p className="text-muted-foreground font-medium">Initializing productOS…</p>
      </div>
    </div>
  );
}

function App() {
  console.log('[APP] Rendering App component');
  const [isFirstInstall, setIsFirstInstall] = useState<boolean | null>(null);
  const [showInstallation, setShowInstallation] = useState(false);
  const [isServerOffline, setIsServerOffline] = useState(false);

  useEffect(() => {
    const checkInstallation = async () => {
      console.log('[APP] Checking installation status & server health...');
      try {
        // Fast path: if the app was already initialized (e.g. returning user or E2E test
        // that pre-set the flag via addInitScript), skip the blocking server health poll
        // and directly check the installation state. The workspace will gracefully handle
        // an offline server via per-request fallbacks.
        const alreadyInitialized = !!localStorage.getItem('productOS_runtime_initialized');
        const mockOnboarding = localStorage.getItem('productOS_mock_onboarding') === 'false';

        // Fast path check for server health first
        const isOnline = await checkServerHealth();
        if (!isOnline) {
          console.log('[APP] Server check failed, showing offline overlay');
          setIsServerOffline(true);
          return;
        }

        if (alreadyInitialized) {
          console.log('[APP] App already initialized, checking installation state...');
          const firstInstall = await appApi.isFirstInstall();
          console.log('[APP] First install status from server:', firstInstall);

          setIsFirstInstall(firstInstall);
          // Only show installation if server says so AND we are not mocking it away in E2E
          setShowInstallation(firstInstall && !mockOnboarding);
          return;
        }

        // First-time flow: wait for the companion server to come up before showing
        // the installation wizard (it needs server capabilities to proceed).
        let healthAttempts = 0;
        const maxHealthAttempts = 5;
        let online: boolean = isOnline;

        while (healthAttempts < maxHealthAttempts && !online) {
          const healthStatus = await checkServerHealth();
          online = healthStatus;
          if (!online) {
            healthAttempts++;
            if (healthAttempts < maxHealthAttempts) {
              console.log(`[APP] Server health check failed (attempt ${healthAttempts}/${maxHealthAttempts}), retrying...`);
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }

        if (!online) {
          console.log('[APP] Server check failed after max attempts, showing offline overlay');
          setIsServerOffline(true);
          return;
        }

        const firstInstall = await appApi.isFirstInstall();
        console.log('[APP] First install status:', firstInstall);
        setIsFirstInstall(firstInstall);
        setShowInstallation(firstInstall);
      } catch (error) {
        console.error('[APP] Failed to check installation status:', error);
        // Detect if server is offline from various error patterns
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isOfflineError =
          (error instanceof TypeError && errorMsg.includes('fetch')) ||
          errorMsg.includes('Server offline') ||
          errorMsg.includes('Failed to fetch') ||
          errorMsg.includes('NetworkError');

        if (isOfflineError) {
          setIsServerOffline(true);
        } else {
          setIsFirstInstall(false);
          setShowInstallation(false);
        }
      }
    };

    checkInstallation();

    // Auto-cleanup legacy service workers that might be caching offline states
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          console.log('[APP] Unregistering legacy service worker:', registration);
          registration.unregister();
        }
      });
    }

    return () => { };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.body.classList.add('paused');
      } else {
        document.body.classList.remove('paused');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let gaInitialized = false;
    const GA_QUEUE_KEY = 'productos_telemetry_queue';

    const getQueuedEvents = (): any[] => {
      try {
        const stored = localStorage.getItem(GA_QUEUE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    };

    const saveQueuedEvents = (events: any[]) => {
      try {
        localStorage.setItem(GA_QUEUE_KEY, JSON.stringify(events));
      } catch (err) {
        console.error('[Telemetry] Failed to save queue to localStorage:', err);
      }
    };

    const queueEvent = (name: string, payload: any) => {
      const queue = getQueuedEvents();
      if (queue.length < 100) {
        queue.push({ name, payload, timestamp: new Date().toISOString() });
        saveQueuedEvents(queue);
      }
    };

    const flushQueue = async () => {
      if (!navigator.onLine || !gaInitialized) return;
      const queue = getQueuedEvents();
      if (queue.length === 0) return;

      console.log(`[Telemetry] Flushing ${queue.length} queued events to Google Analytics`);
      const remaining: any[] = [];

      for (const item of queue) {
        try {
          ReactGA.event({
            category: 'Telemetry',
            action: item.name,
            ...item.payload,
            queued_at: item.timestamp,
          });
        } catch (err) {
          console.error('[Telemetry] Failed to send queued event:', err);
          remaining.push(item);
        }
      }

      saveQueuedEvents(remaining);
    };

    const getBrowserName = (): string => {
      const ua = navigator.userAgent;
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('SamsungBrowser')) return 'Samsung Browser';
      if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
      if (ua.includes('Trident')) return 'Internet Explorer';
      if (ua.includes('Edge') || ua.includes('Edg')) return 'Edge';
      if (ua.includes('Chrome')) return 'Chrome';
      if (ua.includes('Safari')) return 'Safari';
      return 'Unknown';
    };

    const getOSName = (): string => {
      const ua = navigator.userAgent;
      if (ua.includes('Windows NT')) return 'Windows';
      if (ua.includes('Mac OS X')) return 'macOS';
      if (ua.includes('Linux')) return 'Linux';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('like Mac OS X')) return 'iOS';
      return 'Unknown';
    };

    const getOrCreateInstallId = (): string => {
      const key = 'productos_telemetry_install_id';
      let installId = localStorage.getItem(key);
      if (!installId) {
        try {
          installId = crypto.randomUUID();
        } catch {
          installId = 'f-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
        }
        localStorage.setItem(key, installId);
      }
      return installId;
    };

    const initializeGA = (appVersion: string) => {
      if (gaInitialized) return;
      const installId = getOrCreateInstallId();
      const os = getOSName();
      const browser = getBrowserName();

      ReactGA.initialize('G-5L4YKT4HJV', {
        gtagOptions: {
          client_id: installId,
          user_id: installId,
          app_version: appVersion,
          app_name: 'ProductOS',
          user_properties: {
            app_version: appVersion,
            user_os: os,
            user_browser: browser
          }
        }
      });

      ReactGA.set({
        app_version: appVersion,
        user_os: os,
        user_browser: browser
      });

      gaInitialized = true;
    };

    const setupGA = async () => {
      try {
        const [settings, appVersion] = await Promise.all([
          appApi.getGlobalSettings(),
          appApi.getAppVersion()
        ]);

        if (settings.telemetry?.enabled !== false) {
          initializeGA(appVersion);
          await flushQueue();
        }

        unlisten = await runtimeApi.listen<any>('telemetry-event', async (event) => {
          try {
            const currentSettings = await appApi.getGlobalSettings();
            if (currentSettings.telemetry?.enabled !== false) {
              const currentVersion = await appApi.getAppVersion();
              initializeGA(currentVersion);
              const { event: name, payload } = event.payload;
              if (navigator.onLine) {
                try {
                  if (name === 'view.changed' && payload?.view) {
                    ReactGA.send({
                      hitType: 'pageview',
                      page: `/view/${payload.view}`,
                      title: payload.view
                    });
                  }

                  ReactGA.event({
                    category: 'Telemetry',
                    action: name,
                    ...payload
                  });
                } catch (err) {
                  console.warn('[Telemetry] Send failed, queueing event:', err);
                  queueEvent(name, payload);
                }
              } else {
                queueEvent(name, payload);
              }
            }
          } catch (err) {
            console.error('[Telemetry] Failed to process telemetry-event:', err);
          }
        });
      } catch (err) {
        console.error('[Telemetry] Failed to setup Google Analytics:', err);
      }
    };

    setupGA();

    const handleOnline = () => {
      void flushQueue().catch(undefined);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      if (unlisten) unlisten();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleInstallationComplete = () => {
    setShowInstallation(false);
    setIsFirstInstall(false);
  };

  const handleSkipInstallation = () => {
    setShowInstallation(false);
  };

  if (isServerOffline) {
    return <ServerOfflineOverlay />;
  }

  // Show loading state while checking
  if (isFirstInstall === null) {
    return <AppBootSplash />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
      {/* Running with native window chrome or browser chrome, no custom title bar needed */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <Suspense fallback={<AppBootSplash />}>
        <main id="main-content" className="flex-1 overflow-hidden relative flex flex-col min-h-0">
          {showInstallation ? (
            <InstallationWizard
              onComplete={handleInstallationComplete}
              onSkip={handleSkipInstallation}
            />
          ) : (
            <DropdownMenuProvider>
              <Workspace />
              <Toaster />
            </DropdownMenuProvider>
          )}
        </main>
      </Suspense>
    </div>
  );
}

export default App;
