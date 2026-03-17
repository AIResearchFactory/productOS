import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { tauriApi, ClaudeCodeInfo, OllamaInfo, GeminiInfo, InstallationProgress as TauriInstallationProgress, OpenAiAuthStatus } from '@/api/tauri';
import ProgressDisplay, { ProgressStep } from './ProgressDisplay';
import DirectorySelector from './DirectorySelector';
import DependencyStatus from './DependencyStatus';
import InstallationInstructions from './InstallationInstructions';
import { ArrowRight, ArrowLeft, CheckCircle2, FolderOpen, Terminal, Sparkles, AlertCircle, Cpu, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GlassCard } from '@/components/ui/GlassCard';
import Logo from '@/components/ui/Logo';
import { motion, AnimatePresence } from 'framer-motion';

type WizardStep =
  | 'welcome'
  | 'directory'
  | 'detecting'
  | 'dependencies'
  | 'instructions'
  | 'installing'
  | 'provider'
  | 'complete';

interface InstallationWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function InstallationWizard({ onComplete, onSkip }: InstallationWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [selectedPath, setSelectedPath] = useState('');
  const [defaultPath, setDefaultPath] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['geminiCli']); // Default to geminiCli
  const [claudeCodeInfo, setClaudeCodeInfo] = useState<ClaudeCodeInfo | null>(null);
  const [ollamaInfo, setOllamaInfo] = useState<OllamaInfo | null>(null);
  const [geminiInfo, setGeminiInfo] = useState<GeminiInfo | null>(null);
  const [openAiAuthStatus, setOpenAiAuthStatus] = useState<OpenAiAuthStatus | null>(null);
  const [claudeCodeInstructions, setClaudeCodeInstructions] = useState('');
  const [ollamaInstructions, setOllamaInstructions] = useState('');
  const [geminiInstructions, setGeminiInstructions] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installationProgress, setInstallationProgress] = useState<TauriInstallationProgress | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadDefaultPath = async () => {
      try {
        const config = await tauriApi.checkInstallationStatus();
        setDefaultPath(config.app_data_path);
        setSelectedPath(config.app_data_path);
      } catch (error) {
        console.error('Failed to load default path:', error);
      }
    };
    loadDefaultPath();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (['dependencies', 'instructions', 'provider'].includes(currentStep)) {
      interval = setInterval(async () => {
        try {
          const [openaiStatus, googleStatus] = await Promise.all([
            tauriApi.getOpenAIAuthStatus(),
            tauriApi.getGoogleAuthStatus()
          ]);
          
          setOpenAiAuthStatus(openaiStatus as OpenAiAuthStatus);
          
          // Also update geminiInfo with the new auth status
          setGeminiInfo(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              auth_status: {
                connected: googleStatus.connected,
                method: googleStatus.method,
                details: googleStatus.details
              }
            };
          });
        } catch (e) {
          console.error('Polling auth status failed:', e);
        }
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStep]);

  const detectDependencies = async () => {
    setIsDetecting(true);
    try {
      const [claude, ollama, gemini, claudeInstr, ollamaInstr, geminiInstr, openaiStatus] = await Promise.all([
        tauriApi.detectClaudeCode(),
        tauriApi.detectOllama(),
        tauriApi.detectGemini(),
        tauriApi.getClaudeCodeInstallInstructions(),
        tauriApi.getOllamaInstallInstructions(),
        tauriApi.getGeminiInstallInstructions(),
        tauriApi.getOpenAIAuthStatus()
      ]);

      setClaudeCodeInfo(claude);
      setOllamaInfo(ollama);
      setGeminiInfo(gemini);
      setOpenAiAuthStatus(openaiStatus as OpenAiAuthStatus);
      setClaudeCodeInstructions(claudeInstr);
      setOllamaInstructions(ollamaInstr);
      setGeminiInstructions(geminiInstr);
    } catch (error) {
      console.error('Failed to detect dependencies:', error);
      toast({
        title: 'Detection Error',
        description: 'Failed to detect dependencies. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleNext = async () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('directory');
        break;
      case 'directory':
        setCurrentStep('provider');
        break;
      case 'provider':
        setCurrentStep('detecting');
        await detectDependencies();
        setCurrentStep('dependencies');
        break;
      case 'dependencies':
        const missingClaude = selectedProviders.includes('claudeCode') && !claudeCodeInfo?.installed;
        const missingOllama = selectedProviders.includes('ollama') && !ollamaInfo?.installed;
        const missingGemini = selectedProviders.includes('geminiCli') && !geminiInfo?.installed;
        const missingOpenAi = selectedProviders.includes('openAiCli') && !openAiAuthStatus?.connected;
        
        if (missingClaude || missingOllama || missingGemini || missingOpenAi) {
          setCurrentStep('instructions');
        } else {
          setCurrentStep('installing');
          await runInstallation();
        }
        break;
      case 'instructions':
        setCurrentStep('installing');
        await runInstallation();
        break;
      case 'complete':
        onComplete();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'directory':
        setCurrentStep('welcome');
        break;
      case 'provider':
        setCurrentStep('directory');
        break;
      case 'dependencies':
        setCurrentStep('provider');
        break;
      case 'instructions':
        setCurrentStep('dependencies');
        break;
    }
  };

  const handleRedetect = async () => {
    await detectDependencies();
  };

  const runInstallation = async () => {
    setIsInstalling(true);
    try {
      const result = await tauriApi.runInstallation((progress) => {
        setInstallationProgress(progress);
      });

      if (result.success) {
        setCurrentStep('complete');
        toast({
          title: 'Installation Complete',
          description: 'Application setup completed successfully!'
        });
      } else {
        toast({
          title: 'Installation Error',
          description: result.error_message || 'Installation failed',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Installation failed:', error);
      toast({
        title: 'Installation Error',
        description: `Failed to complete installation: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const getProgressSteps = (): ProgressStep[] => {
    // Re-use logic for progress
    const baseSteps: ProgressStep[] = [
      {
        id: 'init',
        label: 'Initialize',
        status: installationProgress ?
          (installationProgress.stage === 'initializing' ? 'in_progress' : 'completed') :
          'pending',
        message: installationProgress?.stage === 'initializing' ? installationProgress.message : undefined
      },
      {
        id: 'structure',
        label: 'Directories',
        status: installationProgress ?
          (installationProgress.stage === 'creating_structure' ? 'in_progress' :
            ['initializing'].includes(installationProgress.stage) ? 'pending' : 'completed') :
          'pending',
        message: installationProgress?.stage === 'creating_structure' ? installationProgress.message : undefined
      },
      {
        id: 'detect',
        label: 'Dependencies',
        status: installationProgress ?
          (installationProgress.stage === 'detecting_dependencies' ? 'in_progress' :
            ['initializing', 'creating_structure'].includes(installationProgress.stage) ? 'pending' : 'completed') :
          'pending',
        message: installationProgress?.stage === 'detecting_dependencies' ? installationProgress.message : undefined
      },
      {
        id: 'finalize',
        label: 'Finalize',
        status: installationProgress ?
          (installationProgress.stage === 'finalizing' ? 'in_progress' :
            installationProgress.stage === 'complete' ? 'completed' : 'pending') :
          'pending',
        message: installationProgress?.stage === 'finalizing' ? installationProgress.message : undefined
      }
    ];

    return baseSteps;
  };

  // --- Step Content Renderers ---

  const handleAuthenticate = async (provider: string) => {
    try {
      if (provider === 'OpenAI (ChatGPT Login)') {
        await tauriApi.authenticateOpenAI();
      } else if (provider === 'Gemini CLI') {
        await tauriApi.authenticateGemini();
      }
      
      toast({
        title: 'Authentication Started',
        description: 'Please follow the instructions in your browser.'
      });
      
      // Refresh status after a delay or on return?
      // Better yet, just redetect after a few seconds or let the user click redetect
    } catch (error) {
       toast({
        title: 'Authentication Failed',
        description: `${error}`,
        variant: 'destructive'
      });
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="flex flex-col h-full justify-center space-y-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <h1 className="text-4xl font-bold text-gradient">
                Setup productOS
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Welcome to your AI-powered research workspace. We'll guide you through a quick setup to configure your workspace and AI tools.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <ul className="space-y-4">
                {[
                  { icon: FolderOpen, text: "Configure secure local storage" },
                  { icon: Terminal, text: "Connect Claude, Gemini, & Ollama" },
                  { icon: Sparkles, text: "Initialize AI skills & workflows" }
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-muted-foreground">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        );

      case 'directory':
        return (
          <div className="flex flex-col h-full space-y-6 pt-10">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Workspace Location</h2>
              <p className="text-muted-foreground">Choose where to store your research data and configuration files.</p>
            </div>
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <DirectorySelector
                selectedPath={selectedPath}
                onPathChange={setSelectedPath}
                defaultPath={defaultPath}
              />
            </div>
          </div>
        );

      case 'provider':
        return (
          <div className="flex flex-col h-full space-y-6 pt-10">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Select Your AI Providers</h2>
              <p className="text-muted-foreground">Choose the AI providers you'd like to integrate into your research workspace. You can select multiple.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'claudeCode', name: 'Claude Code', icon: Terminal },
                { id: 'ollama', name: 'Ollama', icon: Cpu },
                { id: 'geminiCli', name: 'Gemini CLI', icon: Sparkles },
                { id: 'openAiCli', name: 'OpenAI (ChatGPT Login)', icon: Key }
              ].map((provider) => {
                const isSelected = selectedProviders.includes(provider.id);
                return (
                  <Button
                    key={provider.id}
                    variant="outline"
                    className={`h-32 flex flex-col items-center justify-center gap-3 p-4 transition-all relative ${
                      isSelected ? 'border-primary bg-primary/10 shadow-md shadow-primary/10' : 'hover:border-primary/50 hover:bg-primary/5'
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedProviders(prev => prev.filter(id => id !== provider.id));
                      } else {
                        setSelectedProviders(prev => [...prev, provider.id]);
                      }
                    }}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <provider.icon className={`w-10 h-10 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-semibold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{provider.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        );

      case 'detecting':
        return (
          <div className="flex flex-col h-full items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-primary/30 animate-ping absolute" />
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center backdrop-blur-sm">
                <Terminal className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-medium">Scanning Environment...</h2>
              <p className="text-muted-foreground">Checking for selected CLI tools and authentication status.</p>
            </div>
          </div>
        );

      case 'dependencies':
        return (
          <div className="flex flex-col h-full space-y-4 pt-6 overflow-hidden">
            <div className="flex-shrink-0 space-y-2">
              <h2 className="text-2xl font-bold">System Status</h2>
              <p className="text-muted-foreground">Verifying status for your selected providers.</p>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 min-h-0">
              <DependencyStatus
                claudeCodeInfo={selectedProviders.includes('claudeCode') ? claudeCodeInfo : null}
                ollamaInfo={selectedProviders.includes('ollama') ? ollamaInfo : null}
                geminiInfo={selectedProviders.includes('geminiCli') ? geminiInfo : null}
                openAiAuthStatus={selectedProviders.includes('openAiCli') ? openAiAuthStatus : null}
                isDetecting={isDetecting}
                onAuthenticate={handleAuthenticate}
              />
            </div>
            {selectedProviders.length === 0 && (
              <div className="flex-shrink-0 flex items-center gap-2 text-amber-500 bg-amber-500/10 p-4 rounded-lg text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>No providers selected. Please go back and select at least one provider.</span>
              </div>
            )}
          </div>
        );

      case 'instructions':
        return (
          <div className="flex flex-col h-full space-y-6 pt-6 ">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Install Dependencies</h2>
              <p className="text-muted-foreground">Follow these commands to set up your AI environment.</p>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <InstallationInstructions
                claudeCodeInstructions={claudeCodeInstructions}
                ollamaInstructions={ollamaInstructions}
                geminiInstructions={geminiInstructions}
                claudeCodeMissing={!claudeCodeInfo?.installed}
                ollamaMissing={!ollamaInfo?.installed}
                geminiMissing={!geminiInfo?.installed}
                openAiAuthStatus={openAiAuthStatus}
                onRedetect={handleRedetect}
                onAuthenticate={handleAuthenticate}
                isRedetecting={isDetecting}
                selectedProviders={selectedProviders}
              />
            </div>
          </div>
        );

      case 'installing':
        return (
          <div className="flex flex-col h-full justify-center space-y-8">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Finalizing Setup</h2>
              <p className="text-muted-foreground">Creating your workspace...</p>
            </div>
            <div className="max-w-md mx-auto w-full">
              <ProgressDisplay
                steps={getProgressSteps()}
                currentStepId={installationProgress?.stage || 'init'}
                progressPercentage={installationProgress?.progress_percentage || 0}
              />
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col h-full justify-center items-center space-y-8">
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold">You're All Set!</h1>
              <p className="text-muted-foreground max-w-sm">
                productOS has been successfully configured. Start your first project and let AI agents do the heavy lifting.
              </p>
            </div>
          </div>
        );
    }
  };

  const getStepIllustration = () => {
    switch (currentStep) {
      case 'welcome': return (
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <div className="w-64 h-64 bg-primary/40 rounded-full blur-3xl animate-pulse" />
        </div>
      );
      case 'directory': return (
        <div className="flex items-center justify-center h-full text-white/10">
          <FolderOpen className="w-32 h-32" />
        </div>
      );
      case 'complete': return (
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <div className="w-64 h-64 bg-green-500/40 rounded-full blur-3xl" />
        </div>
      );
      default: return (
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-64 h-64 bg-primary/40 rounded-full blur-3xl" />
        </div>
      );
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'directory': return selectedPath.length > 0;
      case 'instructions': return true;
      case 'provider': return true;
      default: return true;
    }
  }

  const showBackButton = ['directory', 'provider', 'dependencies', 'instructions'].includes(currentStep);
  const showNextButton = !['detecting', 'installing'].includes(currentStep);
  const showSkipButton = currentStep === 'welcome' && onSkip;

  return (
    <div className="h-full w-full overflow-hidden bg-background text-foreground flex items-center justify-center p-4 relative">
      {/* Ambient Backgound Grid */}


      <GlassCard className="w-full max-w-5xl h-[650px] flex overflow-hidden p-0 shadow-2xl border-white/5 bg-gray-900/40 backdrop-blur-xl">
        {/* Left Panel - Visual/Brand */}
        <div className="w-1/3 bg-black/20 relative flex flex-col justify-between p-8 border-r border-white/5">
          <div className="flex items-center gap-3 z-10">
            <Logo size="md" />
            <span className="font-bold text-lg tracking-tight">productOS</span>
          </div>

          <div className="absolute inset-0 z-0 overflow-hidden">
            {getStepIllustration()}
          </div>

          <div className="z-10 text-xs text-muted-foreground">
            v0.2.1
          </div>
        </div>

        {/* Right Panel - Content */}
        <div className="flex-1 p-12 flex flex-col relative bg-background/40">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          {/* Controls Footer */}
          <div className="pt-8 mt-4 border-t border-white/5 flex justify-between items-center">
            <div>
              {showBackButton && (
                <Button variant="ghost" onClick={handleBack} disabled={isDetecting || isInstalling} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              )}
              {showSkipButton && (
                <Button variant="ghost" onClick={onSkip} className="text-muted-foreground hover:text-foreground">
                  Skip Setup
                </Button>
              )}
            </div>

            {showNextButton && (
              <Button onClick={handleNext} disabled={!canProceed() || isDetecting || isInstalling}
                className="bg-primary hover:bg-primary/90 text-white min-w-[140px] shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              >
                {currentStep === 'complete' ? 'Launch Workspace' : 'Continue'}
                {currentStep !== 'complete' && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

