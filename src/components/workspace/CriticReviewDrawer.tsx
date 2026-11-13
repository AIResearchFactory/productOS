import React, { useState, useMemo } from 'react';
import { X, ShieldAlert, Sparkles, Check, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CriticFinding, CriticType } from '@/types/socratic';


export interface CriticReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  overallScore: number;
  summary?: string;
  findings: CriticFinding[];
  onApplyFix: (finding: CriticFinding) => Promise<void>;
  onDismissFinding: (findingId: string, finding: CriticFinding) => void;
  onReAudit?: () => void;
}

const CRITIC_CONFIG: Record<CriticType, { name: string; emoji: string; badgeColor: string }> = {
  devils_pm: {
    name: "The Devil's PM",
    emoji: '👿',
    badgeColor: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  },
  telemetry_guardian: {
    name: 'Telemetry Guardian',
    emoji: '📊',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  tone_inspector: {
    name: 'Tone Inspector',
    emoji: '✍️',
    badgeColor: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  },
};

export const CriticReviewDrawer: React.FC<CriticReviewDrawerProps> = ({
  isOpen,
  onClose,
  isLoading,
  overallScore,
  summary,
  findings,
  onApplyFix,
  onDismissFinding,
  onReAudit,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'suggestion'>('all');
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter out dismissed items
  const visibleFindings = useMemo(() => {
    return findings.filter(f => !dismissedIds.has(f.id));
  }, [findings, dismissedIds]);

  const criticalFindings = useMemo(() => {
    return visibleFindings.filter(f => f.severity === 'critical');
  }, [visibleFindings]);

  const suggestionFindings = useMemo(() => {
    return visibleFindings.filter(f => f.severity === 'suggestion');
  }, [visibleFindings]);

  const filteredFindings = useMemo(() => {
    if (activeTab === 'critical') return criticalFindings;
    if (activeTab === 'suggestion') return suggestionFindings;
    return visibleFindings;
  }, [activeTab, visibleFindings, criticalFindings, suggestionFindings]);

  const handleApplyClick = async (finding: CriticFinding) => {
    setApplyingIds(prev => new Set(prev).add(finding.id));
    try {
      await onApplyFix(finding);
      setAppliedIds(prev => new Set(prev).add(finding.id));
    } catch (err) {
      console.error('Failed to apply fix:', err);
    } finally {
      setApplyingIds(prev => {
        const next = new Set(prev);
        next.delete(finding.id);
        return next;
      });
    }
  };

  const handleDismissClick = (finding: CriticFinding) => {
    setDismissedIds(prev => new Set(prev).add(finding.id));
    onDismissFinding(finding.id, finding);
  };

  if (!isOpen) return null;

  const scoreColor =
    overallScore >= 80
      ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
      : overallScore >= 60
        ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
        : 'text-rose-500 border-rose-500/30 bg-rose-500/10';

  return (
    <aside
      aria-label="Adversarial Quality Check Review"
      aria-live="polite"
      className="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[460px] flex-col border-l border-border bg-background/95 backdrop-blur-xl shadow-2xl transition-all duration-300 ease-in-out"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/80 p-4 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldAlert className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-foreground">
              Adversarial Quality Check
            </h2>
            <p className="text-xs text-muted-foreground">
              Multi-Agent PM, Telemetry & Tone Audits
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onReAudit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onReAudit}
              disabled={isLoading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Re-run audit"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Close review drawer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quality Score & Summary Header */}
      <div className="border-b border-border/60 bg-secondary/30 p-4 sm:px-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overall Quality Score
            </span>
            <p className="text-xs text-muted-foreground">
              {summary || (isLoading ? 'Auditing with 3 mini-agents...' : `${visibleFindings.length} issue(s) identified`)}
            </p>
          </div>
          <div className={`flex h-12 w-14 items-center justify-center rounded-xl border font-mono text-lg font-bold shadow-sm ${scoreColor}`}>
            {overallScore}
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="mt-4 flex gap-1.5 rounded-lg bg-background/80 p-1 border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({visibleFindings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('critical')}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
              activeTab === 'critical'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Critical ({criticalFindings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('suggestion')}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
              activeTab === 'suggestion'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Suggestions ({suggestionFindings.length})
          </button>
        </div>
      </div>

      {/* Findings List */}
      <ScrollArea className="flex-1 p-4 sm:px-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              Running parallel adversarial audits...
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              The Devil's PM, Telemetry Guardian, and Tone Inspector are stress-testing your spec.
            </p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <h3 className="text-sm font-semibold text-foreground">
              {visibleFindings.length === 0
                ? 'All quality checks passed!'
                : `No ${activeTab} findings remaining.`}
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              {visibleFindings.length === 0
                ? 'Your document is watertight against scope creep, telemetry gaps, and tone violations.'
                : 'Switch tabs to review other findings.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 pb-6">
            {filteredFindings.map((finding) => {
              const criticInfo = CRITIC_CONFIG[finding.critic] || {
                name: finding.critic,
                emoji: '🔍',
                badgeColor: 'bg-secondary text-foreground',
              };
              const isApplying = applyingIds.has(finding.id);
              const isApplied = appliedIds.has(finding.id);

              return (
                <div
                  key={finding.id}
                  className={`rounded-xl border p-4 shadow-sm transition-all ${
                    finding.severity === 'critical'
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-border bg-card'
                  }`}
                >
                  {/* Critic Badge & Severity */}
                  <div className="flex items-center justify-between gap-2 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm" role="img" aria-label={criticInfo.name}>
                        {criticInfo.emoji}
                      </span>
                      <Badge variant="outline" className={`text-[10px] font-semibold ${criticInfo.badgeColor}`}>
                        {criticInfo.name}
                      </Badge>
                    </div>
                    <Badge
                      variant={finding.severity === 'critical' ? 'destructive' : 'secondary'}
                      className="text-[10px] uppercase font-bold"
                    >
                      {finding.severity}
                    </Badge>
                  </div>

                  {/* Title & Target Section */}
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                    {finding.title}
                  </h4>
                  {finding.targetSection && (
                    <span className="text-[11px] text-muted-foreground">
                      Section: <strong>{finding.targetSection}</strong>
                    </span>
                  )}

                  {/* Description */}
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {finding.description}
                  </p>

                  {/* Quote Snippet */}
                  {finding.quote && (
                    <div className="mt-2 rounded-md border border-border/80 bg-background/90 p-2 text-xs font-mono text-muted-foreground">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block mb-0.5">
                        Quote in doc:
                      </span>
                      "{finding.quote}"
                    </div>
                  )}

                  {/* Suggested Fix */}
                  {finding.suggestedFix && (
                    <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-foreground">
                      <span className="text-[10px] uppercase font-semibold text-emerald-500 block mb-0.5">
                        Suggested Fix:
                      </span>
                      {finding.suggestedFix}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3.5 flex items-center justify-between border-t border-border/50 pt-2.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismissClick(finding)}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Dismiss
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleApplyClick(finding)}
                      disabled={isApplying || isApplied}
                      className={`h-7 text-xs font-medium transition-all ${
                        isApplied
                          ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      }`}
                    >
                      {isApplying ? (
                        <>
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                          Applying...
                        </>
                      ) : isApplied ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Applied
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1 h-3 w-3" />
                          Apply Fix
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
};
