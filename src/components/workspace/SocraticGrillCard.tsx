import React, { useState } from 'react';
import { Flame, Zap, ArrowRight, SkipForward, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { SocraticQuestion } from '@/types/socratic';

export interface SocraticGrillCardProps {
  mode: 'proposal' | 'interrogation';
  artifactType: 'prd' | 'roadmap' | 'user_story' | 'presentation' | string;
  topic?: string;
  step?: number;
  totalSteps?: number;
  currentQuestion?: SocraticQuestion;
  isLoading?: boolean;
  onAcceptProposal: () => void;
  onBypassProposal: () => void;
  onAnswer: (questionId: string, answer: string, mode: 'chip' | 'custom_text') => void;
  onSkipTurn: () => void;
  onBypassImmediately: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  edge_case: { label: 'Edge Cases & Reliability', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  telemetry: { label: 'Metrics & Telemetry', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  scope: { label: 'Scope & Non-Goals', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  dependency: { label: 'Platform & Dependencies', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
};

const ARTIFACT_NAMES: Record<string, string> = {
  prd: 'Product Requirements Document (PRD)',
  roadmap: 'Strategic Roadmap',
  user_story: 'User Story & Slice',
  presentation: 'Slide Presentation Deck',
};

export const SocraticGrillCard: React.FC<SocraticGrillCardProps> = ({
  mode,
  artifactType,
  topic,
  step = 1,
  totalSteps = 3,
  currentQuestion,
  isLoading = false,
  onAcceptProposal,
  onBypassProposal,
  onAnswer,
  onSkipTurn,
  onBypassImmediately,
}) => {
  const [customAnswer, setCustomAnswer] = useState('');
  const friendlyArtifactName = ARTIFACT_NAMES[artifactType] || artifactType.toUpperCase();

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAnswer.trim() || !currentQuestion) return;
    onAnswer(currentQuestion.id, customAnswer.trim(), 'custom_text');
    setCustomAnswer('');
  };

  const handleChipClick = (option: string) => {
    if (!currentQuestion) return;
    onAnswer(currentQuestion.id, option, 'chip');
    setCustomAnswer('');
  };

  // ────────────────────────────────────────────────────────────────
  // Mode 1: Proposal Invitation
  // ────────────────────────────────────────────────────────────────
  if (mode === 'proposal') {
    return (
      <div className="my-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-amber-500/5 p-4 sm:p-5 shadow-lg shadow-primary/5 transition-all">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Flame className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                Socratic PM Intelligence
              </span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {artifactType}
              </Badge>
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-foreground">
              Ready to craft this {friendlyArtifactName}{topic ? `: "${topic}"` : ''}
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              We can jump straight into generation, or I can grill you on <strong>3–4 high-impact trade-offs</strong> first (rate limits, edge cases, failure states) to make the specification watertight.
            </p>
          </div>
        </div>


        <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3 pl-0 sm:pl-13">
          <Button
            size="sm"
            onClick={onAcceptProposal}
            disabled={isLoading}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-sm transition-all"
          >
            <Flame className="mr-1.5 h-4 w-4" />
            Grill Me First (3–4 Qs)
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onBypassProposal}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground"
          >
            <Zap className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            Generate Immediately
          </Button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Mode 2: Multi-Turn Question Turn
  // ────────────────────────────────────────────────────────────────
  const categoryInfo = currentQuestion?.category ? CATEGORY_LABELS[currentQuestion.category] : null;
  const progressPercent = Math.round((step / Math.max(1, totalSteps)) * 100);

  return (
    <div className="my-4 rounded-xl border border-border bg-card/80 backdrop-blur-md p-4 sm:p-5 shadow-md transition-all">
      {/* Header & Progress */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Socratic PM Clarification
          </span>
          {categoryInfo && (
            <Badge variant="outline" className={`text-[10px] ${categoryInfo.color}`}>
              {categoryInfo.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Question <strong>{step}</strong> of <strong>{totalSteps}</strong>
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Text */}
      <div className="mt-3.5 space-y-2">
        <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
          {currentQuestion?.question || 'Calibrating product requirements...'}
        </h3>
        {currentQuestion?.defaultAssumption && (
          <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
            Default if skipped: {currentQuestion.defaultAssumption}
          </p>
        )}
      </div>

      {/* Quick Select Option Chips */}
      {currentQuestion?.quickOptions && currentQuestion.quickOptions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {currentQuestion.quickOptions.map((opt, idx) => {
            const isDecide = opt.toLowerCase().includes('decide for me');
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(opt)}
                disabled={isLoading}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  isDecide
                    ? 'border-dashed border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    : 'border-border/80 bg-background hover:border-primary/60 hover:bg-primary/5 hover:text-primary'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* Freeform Answer Input */}
      <form onSubmit={handleCustomSubmit} className="mt-3.5 flex gap-2">
        <Input
          value={customAnswer}
          onChange={(e) => setCustomAnswer(e.target.value)}
          placeholder="Or type a custom answer..."
          className="text-xs sm:text-sm h-9 bg-background/80"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !customAnswer.trim()}
          className="h-9 px-3 shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      {/* Footer Controls */}
      <div className="mt-3.5 flex items-center justify-between border-t border-border/40 pt-2.5 text-xs">
        <button
          type="button"
          onClick={onSkipTurn}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <SkipForward className="h-3 w-3" />
          Skip this question
        </button>

        <button
          type="button"
          onClick={onBypassImmediately}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <Zap className="h-3 w-3 text-amber-500" />
          Generate with defaults now
        </button>
      </div>
    </div>
  );
};
