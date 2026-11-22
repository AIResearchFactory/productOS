import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileWarning,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { silentLearnerApi } from '@/api/server';
import type {
  SilentLearnerFinding,
  SilentLearnerRedactionResolveResult,
  SilentLearnerRedactionReview,
} from '@/api/contracts';

interface RedactionReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  redactionId?: string | null;
  onResolved: (result: SilentLearnerRedactionResolveResult) => void;
}

function formatTimeDelta(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 5) return 'within a few seconds';
  if (totalSeconds < 60) return `${totalSeconds} seconds apart`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'} apart`;
  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 48) return `${totalHours} hour${totalHours === 1 ? '' : 's'} apart`;
  const totalDays = Math.round(totalHours / 24);
  return `${totalDays} day${totalDays === 1 ? '' : 's'} apart`;
}

function formatSourceLabel(source: string): string {
  if (source === 'prompt') return 'User Prompt';
  if (source === 'response') return 'AI Response';
  if (source === 'file_path') return 'File Path';
  return source;
}

function getSeverityClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
    case 'high':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'medium':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30';
  }
}

const FindingList: React.FC<{ findings: SilentLearnerFinding[] }> = ({ findings }) => (
  <ul className="space-y-2.5">
    {findings.map((finding, idx) => (
      <li
        key={`${finding.name}-${finding.source}-${idx}`}
        className="rounded-xl border border-border bg-card p-3 space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{finding.label}</span>
            <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {finding.name}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={`border text-[10px] px-1.5 py-0 ${getSeverityClass(finding.severity)}`}>
              {finding.severity}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {formatSourceLabel(finding.source)}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
              ×{finding.matchCount}
            </Badge>
          </div>
        </div>
        {finding.snippets && finding.snippets.length > 0 && (
          <div className="space-y-1">
            {finding.snippets.map((snippet, sIdx) => (
              <pre
                key={sIdx}
                className="text-[11px] font-mono rounded-lg bg-muted/60 px-2.5 py-1.5 text-muted-foreground whitespace-pre-wrap break-all"
              >
                {snippet}
              </pre>
            ))}
          </div>
        )}
      </li>
    ))}
  </ul>
);

export const RedactionReviewDialog: React.FC<RedactionReviewDialogProps> = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  redactionId = null,
  onResolved,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const rulesHeadingId = useId();
  const chatHeadingId = useId();
  const deleteWarningId = useId();

  const [review, setReview] = useState<SilentLearnerRedactionReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const loadReview = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await silentLearnerApi.getRedactionReview(projectId, redactionId);
      setReview(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load redaction details.');
      setReview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setShowRawText(false);
      setConfirmDelete(false);
      setError(null);
      if (!dialog.open) {
        dialog.showModal();
      }
      void loadReview();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, projectId, redactionId]);

  const handleNativeClose = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.returnValue = '';
    }
    setConfirmDelete(false);
    setShowRawText(false);
    if (open) {
      onOpenChange(false);
    }
  };

  const handleNativeCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (isResolving) {
      e.preventDefault();
    }
  };

  const handleResolve = async (action: 'acknowledge' | 'delete_chat') => {
    if (!projectId || isResolving) return;
    setIsResolving(true);
    setError(null);
    try {
      const result = await silentLearnerApi.resolveRedaction(projectId, {
        redactionId: review?.redaction?.id || redactionId || undefined,
        action,
        targetChatFile: action === 'delete_chat' ? review?.chatFile : undefined,
      });
      onOpenChange(false);
      onResolved(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to resolve redaction pause.');
    } finally {
      setIsResolving(false);
    }
  };

  const displayedMessages = review
    ? (showRawText ? review.messages : review.redactedMessages)
    : [];

  const createdLabel = review?.redaction?.createdAt
    ? new Date(review.redaction.createdAt).toLocaleString()
    : null;

  const isFallbackLargeGap =
    review?.chatMatchType === 'nearest_fallback' &&
    review.timeDeltaMs !== null &&
    review.timeDeltaMs > 10 * 60 * 1000;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={handleNativeClose}
      onCancel={handleNativeCancel}
      {...({ closedby: isResolving ? 'none' : 'closerequest' } as any)}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100vh-2rem)] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl open:flex open:flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
            Review Secret Redaction Pause
          </h2>
          <p id={descId} className="text-xs text-muted-foreground leading-relaxed">
            Workspace: <span className="font-medium text-foreground">{projectName}</span>
            {createdLabel ? ` · Detected on ${createdLabel}` : ''}
            {review?.redaction?.detail ? ` (${review.redaction.detail})` : ''}
          </p>
        </div>
        <button
          type="button"
          autoFocus
          disabled={isResolving}
          onClick={() => onOpenChange(false)}
          aria-label="Close dialog"
          className="flex h-8 w-8 min-w-[32px] min-h-[32px] shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
            {!review && !loading && (
              <Button size="sm" variant="outline" onClick={() => void loadReview()} className="h-7 text-2xs shrink-0">
                Retry
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-xs">Loading redaction details and matching chat interaction...</p>
          </div>
        ) : review ? (
          <>
            {/* Section 1: Triggered Rules */}
            <section aria-labelledby={rulesHeadingId} className="space-y-3">
              <h3
                id={rulesHeadingId}
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Triggered Rules
              </h3>

              {review.hasRuleInfo ? (
                <FindingList findings={review.findings} />
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <FileWarning className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        No rule information was recorded for this pause.
                      </p>
                      <p className="text-2xs text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                        This pause occurred before rule-level tracking was enabled, so the exact pattern name is unavailable.
                        Please review the chat interaction below before acknowledging or deleting it.
                      </p>
                    </div>
                  </div>

                  {review.detectedInChatFile.length > 0 && (
                    <div className="pt-2 border-t border-amber-500/20 space-y-2">
                      <p className="text-2xs font-medium text-amber-800 dark:text-amber-200">
                        Patterns currently detected in this chat file:
                      </p>
                      <FindingList findings={review.detectedInChatFile} />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Section 2: Chat Interaction Review */}
            <section aria-labelledby={chatHeadingId} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                  id={chatHeadingId}
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  Triggering Chat Interaction
                </h3>

                {review.chatMatchType === 'exact' && (
                  <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                    Exact chat match
                  </Badge>
                )}
                {review.chatMatchType === 'nearest_fallback' && (
                  <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                    Closest chat by timestamp (best-effort fallback)
                  </Badge>
                )}
                {review.chatMatchType === 'missing' && (
                  <Badge className="border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-[10px]">
                    Chat file missing
                  </Badge>
                )}
                {review.chatMatchType === 'none' && (
                  <Badge variant="outline" className="text-[10px]">
                    No chat files found
                  </Badge>
                )}
              </div>

              {review.chatFile && (
                <div className="text-2xs text-muted-foreground space-y-1">
                  <p>
                    File: <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">chats/{review.chatFile}</code>
                    {review.chatMatchType === 'nearest_fallback' && review.timeDeltaMs !== null && (
                      <span> · {formatTimeDelta(review.timeDeltaMs)} from redaction time</span>
                    )}
                  </p>
                  {isFallbackLargeGap && (
                    <p className="text-amber-600 dark:text-amber-400">
                      This chat was saved more than 10 minutes away from the redaction timestamp — verify the messages below before deleting.
                    </p>
                  )}
                </div>
              )}

              {displayedMessages.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs text-muted-foreground">
                      {showRawText
                        ? 'Showing original chat text from disk.'
                        : 'Detected secret patterns are masked in this preview.'}
                    </span>
                    <button
                      type="button"
                      aria-pressed={showRawText}
                      onClick={() => setShowRawText((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-2xs font-medium text-foreground hover:bg-secondary transition-colors min-h-[28px]"
                    >
                      {showRawText ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          Mask detected secrets
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          Show original text
                        </>
                      )}
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                    {displayedMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-border/70 bg-card p-3 space-y-1.5"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {msg.role === 'user' ? 'User' : 'Assistant'}
                        </div>
                        <div className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                  {review.chatMatchType === 'missing'
                    ? `The chat file (${review.chatFile}) is no longer present in this workspace. You can still acknowledge this pause and resume Silent Learner.`
                    : 'No saved chat files were found in this workspace. You can still acknowledge this pause and resume Silent Learner.'}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      {/* Footer with space-reserved confirmation step (prevents pointer shift) */}
      <div className="border-t border-border bg-card/60 px-6 py-4 space-y-3">
        {/* Reserved confirmation banner space */}
        <div
          aria-hidden={!confirmDelete}
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 min-h-[56px] ${
            confirmDelete ? 'visible' : 'invisible pointer-events-none'
          }`}
        >
          <p id={deleteWarningId} className="text-2xs text-red-700 dark:text-red-300 leading-snug">
            Permanently delete{' '}
            <code className="font-mono font-semibold">{review?.chatFile || 'this chat'}</code>, remove its
            research log entry, forget Silent Learner events, and resume learning?
          </p>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={!confirmDelete || isResolving}
            tabIndex={confirmDelete ? 0 : -1}
            aria-describedby={deleteWarningId}
            onClick={() => void handleResolve('delete_chat')}
            className="shrink-0 gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            {isResolving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            Confirm Delete & Resume
          </Button>
        </div>

        {/* Non-shifting action bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-2xs text-muted-foreground">
            {review && !review.canDeleteChat && (
              <span>No chat file available to delete for this pause.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isResolving}
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>

            {confirmDelete ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isResolving}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel Delete
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={!review || !review.canDeleteChat || loading || isResolving}
                onClick={() => setConfirmDelete(true)}
                className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Delete Chat & Resume
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              disabled={!review || loading || isResolving}
              onClick={() => void handleResolve('acknowledge')}
              className="gap-1.5 bg-primary hover:bg-primary/95 text-white"
            >
              {isResolving && !confirmDelete ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Acknowledge & Resume
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default RedactionReviewDialog;
