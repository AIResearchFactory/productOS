import { useState, useEffect } from 'react';
import Workspace from './pages/Workspace';
import InstallationWizard from './components/Installation/InstallationWizard';
import { appApi } from './api/app';
import { Toaster } from './components/ui/toaster';
import { DropdownMenuProvider } from './components/ui/dropdown-menu';
import { TitleBar } from '@/components/ui/TitleBar';
import Logo from '@/components/ui/Logo';
import { checkServerHealth } from '@/api/server';
import ServerOfflineOverlay from '@/components/workspace/ServerOfflineOverlay';

function App() {
  console.log('[APP] Rendering App component');
  const [isFirstInstall, setIsFirstInstall] = useState<boolean | null>(null);
  const [showInstallation, setShowInstallation] = useState(false);
  const [isServerOffline, setIsServerOffline] = useState(false);

  useEffect(() => {
    const checkInstallation = async () => {
      console.log('[APP] Checking installation status & server health...');
      try {
        const isOnline = await checkServerHealth();
        if (!isOnline) {
          console.log('[APP] Server check failed, showing offline overlay');
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

    // Add a global listener for failed fetches to the backend port
    const handleGlobalError = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof TypeError && (
          event.reason.message.includes('Failed to fetch') || 
          event.reason.message.includes('NetworkError')
      )) {
        // If we were trying to hit our backend port, trigger offline
        if (event.reason.stack?.includes('51423')) {
          setIsServerOffline(true);
        }
      }
    };

    window.addEventListener('unhandledrejection', handleGlobalError);
    checkInstallation();
    return () => window.removeEventListener('unhandledrejection', handleGlobalError);
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
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <TitleBar />
        <div className="text-center animate-pulse flex flex-col items-center gap-4">
          <Logo size="md" />
          <p className="text-muted-foreground font-medium">Initializing productOS…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
      {/* Native decorations enabled, custom TitleBar removed */}
      <a 
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
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
    </div>
  );
}

export default App;
