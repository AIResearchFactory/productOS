import { useState, useEffect } from 'react';
import Workspace from './pages/Workspace';
import InstallationWizard from './components/Installation/InstallationWizard';
import { tauriApi } from './api/tauri';
import { Toaster } from './components/ui/toaster';
import { DropdownMenuProvider } from './components/ui/dropdown-menu';
import { TitleBar } from '@/components/ui/TitleBar';
import Logo from '@/components/ui/Logo';

function App() {
  const [isFirstInstall, setIsFirstInstall] = useState<boolean | null>(null);
  const [showInstallation, setShowInstallation] = useState(false);

  useEffect(() => {
    const checkInstallation = async () => {
      try {
        const firstInstall = await tauriApi.isFirstInstall();
        setIsFirstInstall(firstInstall);
        setShowInstallation(firstInstall);
      } catch (error) {
        console.error('Failed to check installation status:', error);
        // If we can't check, assume not first install and proceed to workspace
        setIsFirstInstall(false);
        setShowInstallation(false);
      }
    };

    checkInstallation();
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
      <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
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
