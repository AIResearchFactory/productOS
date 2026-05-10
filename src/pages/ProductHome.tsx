import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, Workflow, FolderPlus, Settings, Activity, ArrowRight, Layers, CheckCircle2, ChevronRight } from 'lucide-react';
import { Artifact } from '@/api/types';

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
  onSendPrompt?: (prompt: string) => void;
  artifacts?: Artifact[];
}

export default function ProductHome({
  product,
  workflows = [],
  onOpenFile,
  onOpenChat,
  onCreateProduct,
  onOpenProductSettings,
  onTabChange,
  onSendPrompt,
  artifacts = [],
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
  const nextAction = documents.length === 0
    ? 'Create or import the first product document.'
    : workflows.length === 0
      ? 'Turn a repeatable task into a workflow.'
      : 'Ask Copilot to summarize the latest product state.';

  const artifactStats = artifacts.reduce((acc, art) => {
    acc[art.artifactType] = (acc[art.artifactType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const artifactLabels: Record<string, string> = {
    roadmap: 'Roadmaps',
    product_vision: 'Visions',
    one_pager: 'One-pagers',
    prd: 'PRDs',
    initiative: 'Initiatives',
    competitive_research: 'Research',
    user_story: 'Stories',
    insight: 'Insights',
    presentation: 'Decks',
    pr_faq: 'PR FAQs'
  };

  const artifactBreakdown = Object.entries(artifactStats)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `${count} ${artifactLabels[type] || type}`)
    .join(', ');

  const stats = [
    { label: 'Files', value: documents.length, icon: FileText },
    { label: 'Artifacts', value: artifacts.length, icon: Layers, breakdown: artifactBreakdown },
    { label: 'Workflows', value: workflows.length, icon: Workflow },
  ];

  const recommendedTasks = [
    {
      title: "Analyze user interview recordings",
      description: "Extract insights, pain points, and feature requests from raw transcripts.",
      prompt: "I want to analyze user interview recordings for this product. Can you help me extract insights, pain points, and feature requests?"
    },
    {
      title: "Create a PRD",
      description: "Draft a comprehensive Product Requirements Document for a new initiative.",
      prompt: "I need to create a new PRD. Please help me draft a comprehensive document including context, goals, user stories, and technical requirements."
    },
    {
      title: "Market research analysis",
      description: "Synthesize market research from analysts like Gartner and Forrester.",
      prompt: "Can you help me synthesize market research for this product category, specifically looking for reports from Gartner and Forrester?"
    },
    {
      title: "Draft launch initiative",
      description: "Plan the go-to-market strategy for a specific feature or release.",
      prompt: "I'm planning a new launch initiative. Can you help me draft a go-to-market strategy including timeline and key milestones?"
    }
  ];

  const handleTaskClick = (prompt: string) => {
    if (onSendPrompt) {
      onSendPrompt(prompt);
    } else if (onOpenChat) {
      onOpenChat();
    }
  };

    const isReady = documents.length > 0 && workflows.length > 0;
    const [showStatusDetails, setShowStatusDetails] = useState(false);

    return (
      <div data-testid="product-home" className="h-full overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(57,78,72,0.20),transparent_34%),hsl(var(--background)/0.35)] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-[#0c0f11]/80 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowStatusDetails(!showStatusDetails)}
                    className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                      isReady
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                        : 'border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                    Product home
                  </button>

                  <AnimatePresence>
                    {showStatusDetails && (
                      <>
                        <div
                          className="fixed inset-0 z-40 cursor-default"
                          onClick={() => setShowStatusDetails(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-white/10 bg-[#161a1d] p-4 shadow-2xl backdrop-blur-xl"
                        >
                          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Product Readiness</h3>
                          <div className="space-y-2">
                            {[
                              ['Workspace created', true],
                              ['Product files added', documents.length > 0],
                              ['Workflows defined', workflows.length > 0],
                            ].map(([label, ready]) => (
                              <div key={String(label)} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                <span className="text-xs text-zinc-300">{label}</span>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${ready ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-zinc-500'}`}>
                                  <CheckCircle2 className="h-3 w-3" />
                                  {ready ? 'READY' : 'NEXT'}
                                </span>
                              </div>
                            ))}
                          </div>
                          {isReady && (
                            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                              <Sparkles className="h-4 w-4 shrink-0" />
                              <p className="text-[11px] font-medium leading-tight">Your product workspace is fully optimized and ready for action.</p>
                            </div>
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
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
                    {stat.breakdown && (
                      <div className="mt-1.5 text-[11px] leading-relaxed text-zinc-400 break-words pr-2" title={stat.breakdown}>
                        {stat.breakdown}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.16)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Recommended Tasks</h2>
                <p className="mt-1 text-sm text-muted-foreground">Strategic actions to accelerate your product.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-1">
              {recommendedTasks.map((task) => (
                <button
                  key={task.title}
                  onClick={() => handleTaskClick(task.prompt)}
                  className="group relative flex items-start gap-4 rounded-2xl border border-white/10 bg-background/40 p-4 text-left transition-all hover:border-emerald-500/30 hover:bg-white/[0.07] hover:shadow-[0_8px_24px_rgba(16,185,129,0.06)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500/20">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-foreground group-hover:text-emerald-300 transition-colors">{task.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{task.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.16)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Recent Files</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Quick access to your latest workspace documents.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
              
              <div className="space-y-3">
                {documents.length > 0 ? (
                  documents.slice(0, 3).map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => onOpenFile?.(doc)}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-white/5 bg-background/40 p-3 text-left transition-all hover:bg-white/[0.07]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-emerald-300">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{doc.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{doc.type}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-1" />
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 rounded-full bg-white/5 p-3">
                      <FileText className="h-6 w-6 text-zinc-600" />
                    </div>
                    <p className="text-sm text-muted-foreground">No files added yet.</p>
                    <Button variant="link" onClick={() => onTabChange?.('products')} className="mt-1 h-auto p-0 text-emerald-400">
                      Add your first file
                    </Button>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.16)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Quick Actions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{nextAction}</p>
                </div>
                <Activity className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => onTabChange?.('artifacts')} className="group rounded-2xl border border-white/5 bg-background/40 p-4 text-left transition-all hover:bg-white/[0.07]">
                  <Layers className="mb-3 h-5 w-5 text-emerald-300" />
                  <div className="font-bold text-foreground">New Artifact</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Create PRDs, roadmaps, or research docs.</p>
                </button>
                <button onClick={() => onTabChange?.('products')} className="group rounded-2xl border border-white/5 bg-background/40 p-4 text-left transition-all hover:bg-white/[0.07]">
                  <FolderPlus className="mb-3 h-5 w-5 text-emerald-300" />
                  <div className="font-bold text-foreground">Import Files</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Add source material to your workspace.</p>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
