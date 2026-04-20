import { useState, useEffect } from 'react';
import Workspace from './pages/Workspace';
import InstallationWizard from './components/Installation/InstallationWizard';
import { appApi } from './api/app';
import { Toaster } from './components/ui/toaster';
import { DropdownMenuProvider } from './components/ui/dropdown-menu';
import Logo from '@/components/ui/Logo';

function App() {
  console.log('[APP] Rendering App component');
  const [isFirstInstall, setIsFirstInstall] = useState<boolean | null>(null);
  const [showInstallation, setShowInstallation] = useState(false);

  useEffect(() => {
    const checkInstallation = async () => {
      console.log('[APP] Checking installation status...');
      try {
        const firstInstall = await appApi.isFirstInstall();
        console.log('[APP] First install status:', firstInstall);
        setIsFirstInstall(firstInstall);
        setShowInstallation(firstInstall);
      } catch (error) {
        console.error('[APP] Failed to check installation status:', error);
        // If we can't check, assume not first install and proceed to workspace
        setIsFirstInstall(false);
        setShowInstallation(false);
      }
    };

    checkInstallation();
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

  // Show loading state while checking
  if (isFirstInstall === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center animate-pulse flex flex-col items-center gap-4">
          <Logo size="md" />
          <p className="text-muted-foreground font-medium">Initializing productOS…</p>
        </div>
      </div>
    );
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
