import Logo from '@/components/ui/Logo';
import {
  FolderPlus,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Plug,
  Layers,
  Zap,
  Cpu,
} from 'lucide-react';

interface WelcomePageProps {
  onCreateProject: () => void;
  onTabChange?: (tab: string) => void;
}

export default function WelcomePage({ onCreateProject, onTabChange }: WelcomePageProps) {
  const actions = [
    {
      icon: FolderPlus,
      title: 'Start a new project',
      description: 'Create an AI-powered workspace with automated research, reusable skills, and full data ownership.',
      action: onCreateProject,
    },
    {
      icon: MessageSquare,
      title: 'Chat with Copilot',
      description: 'Create workflows, install MCP servers, configure AI providers, or generate reports — all from chat.',
      action: onCreateProject,
    },
    {
      icon: Sparkles,
      title: 'Browse AI skills',
      description: 'Reusable AI agent templates for competitive analysis, user research synthesis, and more.',
      action: () => onTabChange?.('research'),
    },
  ];

  const capabilities = [
    { icon: Layers, text: 'Visual workflow automation' },
    { icon: Zap, text: 'Reusable AI agent skills' },
    { icon: Plug, text: 'MCP tool integrations' },
    { icon: Cpu, text: 'Six AI providers, one interface' },
  ];

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-2xl mx-auto px-8 py-16 space-y-16 animate-fade-in">
        {/* Hero */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <Logo size="lg" className="animate-glow-pulse rounded-2xl" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Welcome to <span className="text-gradient">productOS</span>
            </h1>
            <p className="text-lg text-muted-foreground mt-3 leading-relaxed">
              Research smarter. Own your data.
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="space-y-3">
          {actions.map((action, i) => (
            <button
              key={action.title}
              onClick={action.action}
              className="w-full text-left p-5 rounded-xl glass-card transition-all duration-200 group flex items-center gap-4"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                <action.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{action.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>

        {/* Capabilities */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground text-center">
            Automate your research. Keep your data.
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {capabilities.map((cap) => (
              <div
                key={cap.text}
                className="flex items-center gap-3 p-3 rounded-lg glass-card"
              >
                <cap.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground font-medium">{cap.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground/50">
          Press <kbd className="px-1.5 py-0.5 text-[10px] bg-secondary rounded border border-border font-mono">⌘ N</kbd> to create a new document
        </p>
      </div>
    </div>
  );
}