import { Button } from '@/components/ui/button';
import { FileText, MessageSquare, Sparkles, Workflow, FolderPlus, Settings, Activity, ArrowRight, Layers, CheckCircle2 } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
}

interface ProductHomeProps {
  product: { id: string; name: string; description?: string; documents?: Document[] } | null;
  workflows?: { id: string; name: string; status?: string }[];
  onOpenFile?: (doc: Document) => void;
  onOpenChat?: () => void;
  onCreateProduct?: () => void;
  onOpenProductSettings?: () => void;
  onTabChange?: (tab: string) => void;
}

export default function ProductHome({
  product,
  workflows = [],
  onOpenFile,
  onOpenChat,
  onCreateProduct,
  onOpenProductSettings,
  onTabChange,
}: ProductHomeProps) {
  if (!product) {
    return (
      <div className="flex h-full items-center justify-center bg-background/25 p-8">
        <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#394e48]/25 text-emerald-300">
            <FolderPlus className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create your first product</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            ProductOS works best when every product has a focused home for files, artifacts, workflows, and Copilot actions.
          </p>
          <Button onClick={onCreateProduct} className="mt-6 rounded-xl bg-[#394e48] text-white hover:bg-[#48635b]">
            Start a new product
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const documents = product.documents?.filter(doc => doc.type !== 'chat') ?? [];
  const chatDocs = product.documents?.filter(doc => doc.type === 'chat') ?? [];
  const firstDocument = documents[0];
  const nextAction = documents.length === 0
    ? 'Create or import the first product document.'
    : workflows.length === 0
      ? 'Turn a repeatable task into a workflow.'
      : 'Ask Copilot to summarize the latest product state.';

  const stats = [
    { label: 'Files', value: documents.length, icon: FileText },
    { label: 'Chats', value: chatDocs.length, icon: MessageSquare },
    { label: 'Workflows', value: workflows.length, icon: Workflow },
  ];

  return (
    <div data-testid="product-home" className="h-full overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(57,78,72,0.20),transparent_34%),hsl(var(--background)/0.35)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-[#0c0f11]/80 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Product home
              </div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">{product.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
                {product.description || 'A focused command center for this product: files, structured artifacts, workflows, research history, and Copilot.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onOpenProductSettings} className="rounded-xl border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white">
                <Settings className="mr-2 h-4 w-4" />
                Product settings
              </Button>
              <Button onClick={onOpenChat} className="rounded-xl bg-[#394e48] text-white hover:bg-[#48635b]">
                <Sparkles className="mr-2 h-4 w-4" />
                Ask Copilot
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#394e48]/25 text-emerald-300">
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-zinc-400">{stat.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_52px_rgba(0,0,0,0.16)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Next best action</h2>
                <p className="mt-1 text-sm text-muted-foreground">{nextAction}</p>
              </div>
              <Activity className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => firstDocument ? onOpenFile?.(firstDocument) : onTabChange?.('products')}
                className="group rounded-2xl border border-white/10 bg-background/45 p-4 text-left transition-colors hover:bg-white/[0.07]"
              >
                <FileText className="mb-3 h-5 w-5 text-emerald-300" />
                <div className="font-semibold text-foreground">{firstDocument ? 'Continue recent file' : 'Add a product file'}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{firstDocument ? firstDocument.name : 'Use the Products panel to add or import source material.'}</p>
              </button>
              <button onClick={() => onTabChange?.('artifacts')} className="group rounded-2xl border border-white/10 bg-background/45 p-4 text-left transition-colors hover:bg-white/[0.07]">
                <Layers className="mb-3 h-5 w-5 text-emerald-300" />
                <div className="font-semibold text-foreground">Create structured artifact</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">PRDs, roadmaps, research, one-pagers, and launch docs.</p>
              </button>
              <button onClick={() => onTabChange?.('workflows')} className="group rounded-2xl border border-white/10 bg-background/45 p-4 text-left transition-colors hover:bg-white/[0.07]">
                <Workflow className="mb-3 h-5 w-5 text-emerald-300" />
                <div className="font-semibold text-foreground">Automate a repeat task</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Build a workflow for scans, summaries, and recurring product ops.</p>
              </button>
              <button onClick={onOpenChat} className="group rounded-2xl border border-white/10 bg-background/45 p-4 text-left transition-colors hover:bg-white/[0.07]">
                <MessageSquare className="mb-3 h-5 w-5 text-emerald-300" />
                <div className="font-semibold text-foreground">Ask Copilot to make it happen</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Draft, summarize, create files, or run workflow actions with context.</p>
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_52px_rgba(0,0,0,0.16)]">
            <h2 className="text-lg font-semibold text-foreground">Product readiness</h2>
            <div className="mt-4 space-y-3">
              {[
                ['Product workspace created', true],
                ['At least one product file', documents.length > 0],
                ['At least one workflow', workflows.length > 0],
              ].map(([label, ready]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-white/10 bg-background/45 px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${ready ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-muted-foreground'}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {ready ? 'Ready' : 'Next'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
