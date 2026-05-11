import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Sparkles,
  ArrowRight,
  Plug,
  Layers,
  Zap,
  Cpu,
  ShieldCheck,
  FileText,
  Workflow,
  Compass,
  CheckCircle2,
} from 'lucide-react';

interface WelcomePageProps {
  onCreateProject: () => void;
  onTabChange?: (tab: string) => void;
}

export default function WelcomePage({ onCreateProject, onTabChange }: WelcomePageProps) {
  const taskChips = [
    { icon: FileText, label: 'Draft a PRD' },
    { icon: Compass, label: 'Map competitors' },
    { icon: Workflow, label: 'Build a workflow' },
    { icon: Plug, label: 'Connect tools' },
  ];

  const differentiators = [
    {
      icon: Zap,
      title: 'Works from the first product',
      bullets: ['Create a product workspace', 'Seed context and files', 'Ask Copilot what to do next'],
    },
    {
      icon: MessageSquare,
      title: 'It acts, not just chats',
      bullets: ['Generate product docs', 'Run reusable skills', 'Automate workflows with approvals'],
    },
    {
      icon: ShieldCheck,
      title: 'Local-first by default',
      bullets: ['Human-readable Markdown', 'Provider choice stays yours', 'Clear approval moments'],
    },
  ];

  const capabilities = [
    { icon: Layers, text: 'Structured artifacts' },
    { icon: Workflow, text: 'Visual workflow automation' },
    { icon: Zap, text: 'Reusable AI skills' },
    { icon: Cpu, text: 'Bring your own models' },
  ];

  return (
    <div data-testid="welcome-page" className="h-full overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(57,78,72,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_28%),hsl(var(--background))]">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <div className="mb-10 flex items-center justify-between rounded-2xl border border-white/10 bg-background/55 px-4 py-3 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <div className="text-sm font-semibold text-foreground">ProductOS</div>
              <div className="text-[11px] text-muted-foreground">Local-first product command center</div>
            </div>
          </div>
          <div className="hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 sm:block">
            Built for PM work · docs · workflows · research
          </div>
        </div>

        <section className="grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0c0f11]/80 px-4 py-2 text-xs font-semibold text-zinc-300 shadow-[0_16px_40px_rgba(0,0,0,0.20)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]" />
              Start with a product. Let AI do the repetitive work.
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-balance text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Turn product chaos into clear docs, workflows, and decisions.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                ProductOS gives every product a workspace: files, structured artifacts, reusable skills, workflows, and a Copilot that can act with context.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={onCreateProject}
                size="lg"
                data-testid="welcome-primary-create-product"
                className="h-12 rounded-xl bg-[#394e48] px-6 text-white shadow-[0_14px_34px_rgba(57,78,72,0.34)] hover:bg-[#48635b]"
              >
                Start a new product
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => onTabChange?.('skills')}
                className="h-12 rounded-xl border-white/10 bg-white/5 px-6 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                Browse skills
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {capabilities.map((cap) => (
                <div key={cap.text} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-3 text-sm text-muted-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#394e48]/25 text-emerald-300">
                    <cap.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{cap.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#0c0f11]/85 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
                  <Sparkles className="h-4 w-4 text-emerald-300" />
                  Copilot task
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-300">approval-aware</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-background/80 p-4 text-left shadow-inner">
                <p className="text-sm leading-7 text-foreground">
                  Create a launch plan for our onboarding redesign, turn it into a PRD, and schedule a weekly competitor scan.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {taskChips.map((chip) => (
                  <span key={chip.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10">
                    <chip.icon className="h-3.5 w-3.5" />
                    {chip.label}
                  </span>
                ))}
              </div>

              <button
                onClick={onCreateProject}
                className="mt-5 flex w-full items-center justify-between rounded-xl bg-[#394e48] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#48635b]"
              >
                Make it happen
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {differentiators.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-background/55 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#394e48]/25 text-emerald-300">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
