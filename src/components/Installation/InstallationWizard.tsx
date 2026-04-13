import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { appApi, isTauriRuntime } from '@/api/app';
import type { ClaudeCodeInfo, OllamaInfo, GeminiInfo, OpenAiCliInfo, InstallationProgress as TauriInstallationProgress } from '@/api/app';
import ProgressDisplay, { ProgressStep } from './ProgressDisplay';
import DirectorySelector from './DirectorySelector';
import DependencyStatus from './DependencyStatus';
import InstallationInstructions from './InstallationInstructions';
import { ArrowRight, ArrowLeft, CheckCircle2, FolderOpen, Terminal, Sparkles, AlertCircle, Cpu, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GlassCard } from '@/components/ui/GlassCard';
import Logo from '@/components/ui/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { installPersonalStarterPack, seedPersonalContext } from '@/lib/starterPack';

type WizardStep =
  | 'welcome'
  | 'directory'
  | 'projects'
  | 'detecting'
  | 'instructions'
  | 'installing'
  | 'provider'
  | 'personal'
  | 'complete';

interface InstallationWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function InstallationWizard({ onComplete, onSkip }: InstallationWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [selectedPath, setSelectedPath] = useState('');
  const [projectsPath, setProjectsPath] = useState('');
  const [defaultPath, setDefaultPath] = useState('');
  const [defaultProjectsPath, setDefaultProjectsPath] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]); // No default provider pre-selection
  const [claudeCodeInfo, setClaudeCodeInfo] = useState<ClaudeCodeInfo | null>(null);
  const [ollamaInfo, setOllamaInfo] = useState<OllamaInfo | null>(null);
  const [geminiInfo, setGeminiInfo] = useState<GeminiInfo | null>(null);
  const [openAiCliInfo, setOpenAiCliInfo] = useState<OpenAiCliInfo | null>(null);
  const [claudeCodeInstructions, setClaudeCodeInstructions] = useState('');
  const [ollamaInstructions, setOllamaInstructions] = useState('');
  const [geminiInstructions, setGeminiInstructions] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installationProgress, setInstallationProgress] = useState<TauriInstallationProgress | null>(null);
  const [appVersion, setAppVersion] = useState('...');
  const [personalProductName, setPersonalProductName] = useState('My Product');
  const [personalGoal, setPersonalGoal] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [primaryPersona, setPrimaryPersona] = useState('');
  const [topCompetitors, setTopCompetitors] = useState('');
  const [installStarterPack, setInstallStarterPack] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadDefaultPath = async () => {
      try {
        const config = await appApi.checkInstallationStatus();
        setDefaultPath(config.app_data_path);
        setSelectedPath(config.app_data_path);
        
        // Default projects path could be a 'projects' subfolder in app_data_path or a separate Documents folder
        const defaultProj = `${config.app_data_path}${config.app_data_path.includes('\\') ? '\\' : '/'}projects`;
        setDefaultProjectsPath(defaultProj);
        setProjectsPath(defaultProj);
      } catch (error) {
        console.error('Failed to load default path:', error);
      }
    };
    loadDefaultPath();

    const loadVersion = async () => {
      try {
        const v = await appApi.getAppVersion();
        setAppVersion(v);
      } catch {
        setAppVersion('?');
      }
    };
    loadVersion();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (['instructions', 'provider'].includes(currentStep)) {
      interval = setInterval(async () => {
        try {
          if (!isTauriRuntime()) return;
            const [, googleStatus] = await Promise.all([
              Promise.resolve(null),
              appApi.getGoogleAuthStatus()
            ]);
          
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
      const results = await Promise.allSettled([
        appApi.detectClaudeCode(),
        appApi.detectOllama(),
        appApi.detectGemini(),
        Promise.resolve(isTauriRuntime() ? appApi.getClaudeCodeInstallInstructions() : 'Install Claude Code in your own terminal, then return and retry detection.'),
        Promise.resolve(isTauriRuntime() ? appApi.getOllamaInstallInstructions() : 'Install Ollama in your own terminal, then return and retry detection.'),
        Promise.resolve(isTauriRuntime() ? appApi.getGeminiInstallInstructions() : 'Install Gemini CLI in your own terminal, then return and retry detection.'),
        appApi.detectOpenAiCli(),
        Promise.resolve(null),
      ]);

      const getValue = <T,>(idx: number, fallback: T): T => {
        const r = results[idx];
        return r.status === 'fulfilled' ? (r.value as T) : fallback;
      };

      const claude = getValue(0, { installed: false } as ClaudeCodeInfo);
      const ollama = getValue(1, { installed: false } as OllamaInfo);
      const gemini = getValue(2, { installed: false } as GeminiInfo);
      const claudeInstr = getValue(3, 'Install Claude Code from https://claude.ai/download');
      const ollamaInstr = getValue(4, 'Install Ollama from https://ollama.ai/download');
      const geminiInstr = getValue(5, 'Install Gemini CLI from https://ai.google.dev/gemini-api/docs/quickstart');
      const openaiCli = getValue(6, { installed: false, in_path: false } as OpenAiCliInfo);

      setClaudeCodeInfo(claude);
      setOllamaInfo(ollama);
      setGeminiInfo(gemini);
      setOpenAiCliInfo(openaiCli);
      setClaudeCodeInstructions(String(claudeInstr || ''));
      setOllamaInstructions(String(ollamaInstr || ''));
      setGeminiInstructions(String(geminiInstr || ''));
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
        setCurrentStep('projects');
        break;
      case 'projects':
        // Scan environment first, then show provider selection
        setCurrentStep('detecting');
        await detectDependencies();
        setCurrentStep('provider');
        break;
      case 'provider': {
        const missingClaude = selectedProviders.includes('claudeCode') && !claudeCodeInfo?.installed;
        const missingOllama = selectedProviders.includes('ollama') && !ollamaInfo?.installed;
        const missingGemini = selectedProviders.includes('geminiCli') && !geminiInfo?.installed;
          const missingOpenAi = selectedProviders.includes('openAiCli') && !openAiCliInfo?.installed;

        if (missingClaude || missingOllama || missingGemini || missingOpenAi) {
          setCurrentStep('instructions');
        } else {
          setCurrentStep('personal');
        }
        break;
      }
      case 'instructions':
        setCurrentStep('personal');
        break;
      case 'personal':
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
      case 'projects':
        setCurrentStep('directory');
        break;
      case 'provider':
        setCurrentStep('projects');
        break;
      case 'instructions':
        setCurrentStep('provider');
        break;
      case 'personal':
        setCurrentStep('provider');
        break;
    }
  };

  const handleRedetect = async () => {
    await detectDependencies();
  };

  const resolvePreferredProvider = (providers: string[]): string | null => {
    const order = ['claudeCode', 'geminiCli', 'openAiCli', 'ollama'];
    for (const p of order) {
      if (providers.includes(p)) return p;
    }
    return null;
  };

  const runInstallation = async () => {
    setIsInstalling(true);
    try {
      const result = isTauriRuntime()
        ? await appApi.runInstallation(selectedPath, projectsPath, (progress) => {
            setInstallationProgress(progress);
          })
        : { success: true } as any;

      if (result.success) {
        // Save selected providers to global settings
        try {
          const settings = await appApi.getGlobalSettings();
          settings.selectedProviders = selectedProviders;
          const preferred = resolvePreferredProvider(selectedProviders);
          if (preferred) {
            settings.activeProvider = preferred as any;
          }
          await appApi.saveGlobalSettings(settings);
          console.log('[Wizard] Persisted selectedProviders:', selectedProviders, 'activeProvider:', settings.activeProvider);
        } catch (err) {
          console.error('[Wizard] Failed to save selectedProviders:', err);
        }

        // Personal bootstrap (first project + context + optional starter pack)
        try {
          if (personalProductName.trim()) {
            const project = await appApi.createProject(
              personalProductName.trim(),
              personalGoal || 'Initial product workspace',
              []
            );

            await seedPersonalContext(project.id, {
              companyName,
              productName: personalProductName,
              productGoal: personalGoal,
              primaryPersona,
              topCompetitors,
            });

            if (installStarterPack) {
              await installPersonalStarterPack(project.id);
            }
          }
        } catch (bootstrapErr) {
          console.error('[Wizard] Personal bootstrap failed:', bootstrapErr);
        }

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
          <div className="flex flex-col h-full space-y-6 pt-4 overflow-y-auto pr-2">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Workspace Location</h2>
              <p className="text-muted-foreground">Select where to store your application settings and secure configuration.</p>
            </div>
            
            <DirectorySelector
              selectedPath={selectedPath}
              onPathChange={setSelectedPath}
              defaultPath={defaultPath}
              title="Application Settings & Config"
              description="This folder will hold your session data, encrypted secrets, and global settings. This is typically in your user directory's Application Support folder."
            />
          </div>
        );

      case 'projects':
        return (
          <div className="flex flex-col h-full space-y-6 pt-4 overflow-y-auto pr-2">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Workspace Location</h2>
              <p className="text-muted-foreground">Select where to store your research data and projects.</p>
            </div>

            <DirectorySelector
              selectedPath={projectsPath}
              onPathChange={setProjectsPath}
              defaultPath={defaultProjectsPath}
              title="Research Data & Projects"
              description="This folder will hold your research projects, artifacts, and local knowledge base."
              hideRecommended={true}
              pathTitle="Research data path"
              subdirectories={['projects', 'skills']}
            />
          </div>
        );

      case 'provider':
        return (
          <div className="flex flex-col h-full space-y-4 pt-6 overflow-hidden">
            <div className="flex-shrink-0 space-y-2">
              <h2 className="text-2xl font-bold">Select Your AI Providers</h2>
              <p className="text-muted-foreground">Choose the AI providers you'd like to integrate. Detected status is shown below each option.</p>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'claudeCode', name: 'Claude Code', icon: Terminal, info: claudeCodeInfo },
                  { id: 'ollama', name: 'Ollama', icon: Cpu, info: ollamaInfo },
                  { id: 'geminiCli', name: 'Gemini CLI', icon: Sparkles, info: geminiInfo },
                  { id: 'openAiCli', name: 'OpenAI (ChatGPT Login)', icon: Key, info: openAiCliInfo }
                ].map((provider) => {
                  const isSelected = selectedProviders.includes(provider.id);
                  const detected = provider.info ? (provider.info as any).installed : undefined;
                  return (
                    <Button
                      key={provider.id}
                      variant="outline"
                      className={`h-36 flex flex-col items-center justify-center gap-2 p-4 transition-all relative ${
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
                      <provider.icon className={`w-8 h-8 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`font-semibold text-sm ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{provider.name}</span>
                      {detected === true && (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Detected
                        </span>
                      )}
                      {detected === false && (
                        <span className="text-xs text-amber-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Not detected
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* System Status from scan */}
              {(claudeCodeInfo || ollamaInfo || geminiInfo || openAiCliInfo) && (
                <div className="mt-2">
                  <DependencyStatus
                    claudeCodeInfo={selectedProviders.includes('claudeCode') ? claudeCodeInfo : null}
                    ollamaInfo={selectedProviders.includes('ollama') ? ollamaInfo : null}
                    geminiInfo={selectedProviders.includes('geminiCli') ? geminiInfo : null}
                    openAiCliInfo={selectedProviders.includes('openAiCli') ? openAiCliInfo : null}
                      isDetecting={isDetecting}
                    />
                </div>
              )}

              {selectedProviders.length === 0 && (
                <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 p-4 rounded-lg text-sm">
                  <AlertCircle className="w-5 h-5" />
                  <span>No providers selected. Please select at least one.</span>
                </div>
              )}
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
                openAiCliInfo={openAiCliInfo}
                  onRedetect={handleRedetect}
                  isRedetecting={isDetecting}
                  selectedProviders={selectedProviders}
                />
            </div>
          </div>
        );

      case 'personal':
        return (
          <div className="flex flex-col h-full space-y-6 pt-4 overflow-y-auto pr-2">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Personal PM Setup</h2>
              <p className="text-muted-foreground">Set initial product context so your first project opens with useful PM structure, not a blank slate.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="personal-product-name">Product Name</Label>
                <Input
                  id="personal-product-name"
                  data-testid="personal-product-name"
                  value={personalProductName}
                  onChange={(e) => setPersonalProductName(e.target.value)}
                  placeholder="e.g. Mobile App Redesign"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="personal-product-goal">Product Goal</Label>
                <Input
                  id="personal-product-goal"
                  data-testid="personal-product-goal"
                  value={personalGoal}
                  onChange={(e) => setPersonalGoal(e.target.value)}
                  placeholder="What are you trying to achieve?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personal-company">Company <span className="text-xs text-muted-foreground">(saved per project)</span></Label>
                <Input
                  id="personal-company"
                  data-testid="personal-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personal-persona">Primary Persona (seed)</Label>
                <Input
                  id="personal-persona"
                  data-testid="personal-persona"
                  value={primaryPersona}
                  onChange={(e) => setPrimaryPersona(e.target.value)}
                  placeholder="e.g. SMB Product Manager"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="personal-competitors">Top Competitors (seed)</Label>
                <Input
                  id="personal-competitors"
                  data-testid="personal-competitors"
                  value={topCompetitors}
                  onChange={(e) => setTopCompetitors(e.target.value)}
                  placeholder="e.g. Notion, Asana, ClickUp (comma-separated)"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-muted-foreground p-3 rounded-lg border border-white/10 bg-white/5" data-testid="personal-install-starter-pack-row">
              <input
                type="checkbox"
                data-testid="personal-install-starter-pack"
                checked={installStarterPack}
                onChange={(e) => setInstallStarterPack(e.target.checked)}
              />
              Install Personal PM Starter Pack (workflows + templates)
            </label>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground/90 space-y-1">
              <div><strong>What you get after setup:</strong></div>
              <div>• <code>context-personal.md</code> with product, company, and current goal</div>
              <div>• <code>personas.md</code> scaffold for multiple personas</div>
              <div>• <code>competitors.md</code> scaffold you can update over time</div>
              <div>• optional PM starter workflows and templates</div>
            </div>

            <p className="text-xs text-muted-foreground/80">
              Tip: all context here is saved per project and can be refined later in Project Settings.
              We also generate editable <code>personas.md</code> and <code>competitors.md</code> files so you can manage multiple personas and track competitor changes over time.
            </p>
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
      case 'projects': return projectsPath.length > 0;
      case 'instructions': return true;
      case 'provider': return selectedProviders.length > 0;
      case 'personal': return personalProductName.trim().length > 0;
      default: return true;
    }
  }

  const showBackButton = ['directory', 'projects', 'provider', 'instructions', 'personal'].includes(currentStep);
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
            v{appVersion}
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









