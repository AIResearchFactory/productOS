import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  FolderPlus,
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  Zap
} from 'lucide-react';
import { tauriApi } from '../api/tauri';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import Logo from '@/components/ui/Logo';

interface OnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function Onboarding({ onComplete, onSkip }: OnboardingProps) {
  const [step, setStep] = useState('check'); // 'check', 'install', 'welcome', 'create'
  const [checks, setChecks] = useState({
    claudeCli: { status: 'checking', message: '' },
    geminiCli: { status: 'checking', message: '' },
    ollama: { status: 'checking', message: '' },
    apiKeys: { status: 'checking', message: '' },
    dataDir: { status: 'checking', message: '' }
  });
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [copiedCommand, setCopiedCommand] = useState('');

  useEffect(() => {
    runSystemChecks();
  }, []);

  const runSystemChecks = async () => {
    setChecks(prev => {
      const resetting = { ...prev };
      Object.keys(resetting).forEach(key => {
        (resetting as any)[key].status = 'checking';
      });
      return resetting;
    });

    try {
      // Check API keys
      const [hasClaude, hasGemini] = await Promise.all([
        tauriApi.hasClaudeApiKey().catch(() => false),
        tauriApi.hasGeminiApiKey().catch(() => false)
      ]);
      setChecks(prev => ({
        ...prev,
        apiKeys: {
          status: 'success', // Always success as they are optional
          message: (hasClaude || hasGemini)
            ? `API Keys: ${hasClaude ? 'Claude' : ''}${hasClaude && hasGemini ? ' & ' : ''}${hasGemini ? 'Gemini' : ''}`
            : 'Keys not required (will use authenticated CLI)'
        }
      }));

      // Check Providers
      const [claude, ollama, gemini] = await Promise.all([
        tauriApi.detectClaudeCode().catch(() => null),
        tauriApi.detectOllama().catch(() => null),
        tauriApi.detectGemini().catch(() => null)
      ]);

      setChecks(prev => ({
        ...prev,
        claudeCli: {
          status: claude?.installed ? 'success' : 'error',
          message: claude?.installed ? `Claude Code ${claude.version || ''}` : 'Claude Code not found'
        },
        geminiCli: {
          status: gemini?.installed ? 'success' : 'error',
          message: gemini?.installed ? `Gemini CLI ${gemini.version || ''}` : 'Gemini CLI not found'
        },
        ollama: {
          status: ollama?.installed ? 'success' : 'error',
          message: ollama?.installed ? `Ollama ${ollama.version || ''}` : 'Ollama not found'
        },
        dataDir: {
          status: 'success',
          message: 'Data directory initialized'
        }
      }));
    } catch (error) {
      console.error('Failed to run system checks:', error);
      setChecks({
        claudeCli: { status: 'error', message: 'Check failed' },
        geminiCli: { status: 'error', message: 'Check failed' },
        ollama: { status: 'error', message: 'Check failed' },
        apiKeys: { status: 'error', message: 'Check failed' },
        dataDir: { status: 'error', message: 'Check failed' }
      });
    }
  };

  // We can proceed if data directory is ready AND at least one AI provider is available
  const anyAiProviderReady = checks.claudeCli.status === 'success' ||
    checks.geminiCli.status === 'success' ||
    checks.ollama.status === 'success';
  const allChecksPassed = checks.dataDir.status === 'success' && anyAiProviderReady;
  const allChecksComplete = Object.values(checks).every(c => c.status !== 'checking');

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(''), 2000);
  };

  const handleContinue = () => {
    if (allChecksPassed) {
      setStep('welcome');
    } else {
      setStep('install');
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;

    try {
      await tauriApi.createProject(
        projectName,
        projectDesc || 'A new research project',
        []
      );
      onComplete();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'checking') return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
    if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    return <XCircle className="w-5 h-5 text-red-400" />;
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md overflow-hidden">
      {/* Ambient background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      <AnimatePresence mode="wait">
        {step === 'check' && (
          <GlassCard
            key="check"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-2xl border-white/10 dark:border-white/5"
          >
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-4">
                <Logo size="lg" />
              </div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2">Step 1 of 3</div>
              <CardTitle className="text-3xl font-bold tracking-tight text-foreground">productOS</CardTitle>
              <CardDescription className="text-sm mt-2">
                Checking your system for AI providers
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-3">
                {Object.entries(checks).map(([key, check]) => (
                  <motion.div
                    key={key}
                    variants={itemVariants}
                    className="group"
                  >
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border group-hover:bg-secondary/50 transition-colors">
                      <StatusIcon status={check.status} />
                      <div className="flex-1">
                        <p className="font-semibold text-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {check.message || 'Verifying...'}
                        </p>
                      </div>
                      {check.status === 'error' && (
                        <div className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold rounded border border-red-500/20 uppercase tracking-widest">
                          Action Required
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {allChecksComplete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-6 flex gap-4"
                >
                  <Button
                    variant="ghost"
                    onClick={onSkip}
                    className="flex-1 h-12 text-muted-foreground hover:text-foreground"
                  >
                    Skip to App
                  </Button>
                  <Button
                    onClick={handleContinue}
                    className="flex-1 h-12 text-base bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 group transition-all"
                  >
                    {allChecksPassed ? 'Proceed to Workspace' : 'Resolve Issues'}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </GlassCard>
        )}

        {step === 'install' && (
          <GlassCard
            key="install"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-3xl"
          >
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30">
                  <Terminal className="w-10 h-10 text-amber-500" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">Installation Sync</CardTitle>
              <CardDescription className="text-base mt-2">
                A few items need your attention to enable full agentic power
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
              {checks.claudeCli.status === 'error' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">Claude CLI</h3>
                  </div>
                  <div className="relative group">
                    <pre className="bg-black/40 backdrop-blur text-indigo-100 p-5 rounded-xl overflow-x-auto text-sm border border-white/5 font-mono">
                      npm install -g @anthropic-ai/claude-cli
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-3 right-3 bg-white/5 hover:bg-white/10"
                      onClick={() => copyCommand('npm install -g @anthropic-ai/claude-cli')}
                    >
                      {copiedCommand === 'npm install -g @anthropic-ai/claude-cli' ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {checks.geminiCli.status === 'error' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">Gemini CLI</h3>
                  </div>
                  <div className="relative group">
                    <pre className="bg-black/40 backdrop-blur text-indigo-100 p-5 rounded-xl overflow-x-auto text-sm border border-white/5 font-mono">
                      npm install -g @google/gemini-cli
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-3 right-3 bg-white/5 hover:bg-white/10"
                      onClick={() => copyCommand('npm install -g @google/gemini-cli')}
                    >
                      {copiedCommand === 'npm install -g @google/gemini-cli' ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <Button
                  variant="outline"
                  onClick={runSystemChecks}
                  className="flex-1 h-12 border-white/10"
                >
                  <Loader2 className="w-4 h-4 mr-2" />
                  Final Sync Check
                </Button>
                <Button
                  onClick={onSkip}
                  className="flex-1 h-12 bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  Continue Anyway
                </Button>
              </div>
            </CardContent>
          </GlassCard>
        )}

        {step === 'welcome' && (
          <GlassCard
            key="welcome"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-2xl"
          >
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/20"
                >
                  <Sparkles className="w-12 h-12 text-white" />
                </motion.div>
              </div>
              <CardTitle className="text-3xl font-bold text-foreground">You're All Set!</CardTitle>
              <CardDescription className="text-lg mt-2">
                Your product workspace is ready to go.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
              <div className="bg-card rounded-xl p-6 border border-border">
                <ul className="space-y-4">
                  {[
                    "AI-powered copilot for product decisions",
                    "Create discovery playbooks and workflows",
                    "Secure, encrypted local storage for all data",
                    "Automate competitive analysis and user research"
                  ].map((text, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-muted-foreground font-medium">{text}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="flex-1 h-12"
                >
                  Explore productOS
                </Button>
                <Button
                  onClick={() => setStep('create')}
                  className="flex-1 h-12 bg-primary shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                >
                  Start New Project
                  <FolderPlus className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </GlassCard>
        )}

        {step === 'create' && (
          <GlassCard
            key="create"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-2xl"
          >
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20 shadow-inner">
                  <FolderPlus className="w-10 h-10 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">Your First Product</CardTitle>
              <CardDescription className="text-base mt-2">
                What product are you working on?
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-sm font-semibold opacity-70 ml-1 uppercase tracking-wider">Product Name</Label>
                  <Input
                    id="project-name"
                    placeholder="e.g. Mobile App Redesign Q3"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="h-14 bg-white/5 border-white/10 rounded-xl px-5 text-lg focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-desc" className="text-sm font-semibold opacity-70 ml-1 uppercase tracking-wider">Product Goal</Label>
                  <Input
                    id="project-desc"
                    placeholder="What's the product goal?"
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    className="h-14 bg-white/5 border-white/10 rounded-xl px-5"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setStep('welcome')}
                  className="flex-1 h-12"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={!projectName.trim()}
                  className="flex-1 h-12 bg-primary shadow-emerald-500/10 hover:shadow-xl transition-all disabled:opacity-30 disabled:hover:scale-100"
                >
                  Launch productOS
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </GlassCard>
        )}
      </AnimatePresence>
    </div>
  );
}
