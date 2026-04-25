import { lazy, Suspense, useState, useEffect } from 'react';
import { appApi } from './api/app';
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
        let isOnline = false;
        let healthAttempts = 0;
        const maxHealthAttempts = 5;

        while (healthAttempts < maxHealthAttempts && !isOnline) {
          isOnline = await checkServerHealth();
          if (!isOnline) {
            healthAttempts++;
            if (healthAttempts < maxHealthAttempts) {
              console.log(`[APP] Server health check failed (attempt ${healthAttempts}/${maxHealthAttempts}), retrying...`);
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }

        if (!isOnline) {
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
        // If it's a fetch error, it's likely the server is down
        if (error instanceof TypeError && error.message.includes('fetch')) {
           setIsServerOffline(true);
        } else {
           setIsFirstInstall(false);
           setShowInstallation(false);
        }
      }
    };

    checkInstallation();
    return () => {};
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
