/**
 * RichMarkdownEditor.tsx
 * Core WYSIWYG rich text editor built on Tiptap v2.
 *
 * Features:
 *  - Inline editing with formatted output (headings, lists, bold, italic, etc.)
 *  - Bubble menu on text selection (EditorBubbleMenu)
 *  - Slash command menu for block insertion (SlashCommandExtension)
 *  - AI ghost-text auto-completion (via custom ProseMirror decoration)
 *  - Bidirectional markdown serialization (@tiptap/markdown)
 *  - Sidecar inline commenting highlights and marginal card panels
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown as TiptapMarkdown } from '@tiptap/markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Extension, Editor } from '@tiptap/core';
import { Plugin, PluginKey, EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import { useToast } from '@/hooks/use-toast';
import { telemetryApi } from '@/api/server';
import type { Comment } from '@/api/contracts';

import {
  MessageSquare,
  MessageSquarePlus,
  Sparkles,
  Trash2,
  CheckCircle2,
  X,
  Undo2,
  Edit2,
  Check,
  AlertTriangle,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

import EditorBubbleMenu from './EditorBubbleMenu';
import { SlashCommandExtension } from './SlashCommandMenu';

const openUrl = async (url: string) => window.open(url, '_blank');

// ────────────────────────────────────────────────────────────────────────────
// AI Ghost Text Extension
// ────────────────────────────────────────────────────────────────────────────

const GhostTextPluginKey = new PluginKey('ghostText');

interface GhostTextOptions {
  suggestion: string | null;
}

const GhostTextExtension = Extension.create<GhostTextOptions>({
  name: 'ghostText',

  addOptions() {
    return {
      suggestion: null,
    };
  },

  addProseMirrorPlugins() {
    const { suggestion } = this.options;

    return [
      new Plugin({
        key: GhostTextPluginKey,
        props: {
          decorations(state: EditorState) {
            if (!suggestion) return DecorationSet.empty;

            const { selection } = state;
            if (!selection.empty) return DecorationSet.empty;

            const widget = document.createElement('span');
            widget.className = 'ai-ghost-text';
            widget.textContent = suggestion;

            return DecorationSet.create(state.doc, [
              Decoration.widget(selection.from, widget, { side: 1 }),
            ]);
          },
        },
      }),
    ];
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Comment Highlight Extension (ProseMirror Decorations)
// ────────────────────────────────────────────────────────────────────────────

const CommentHighlightPluginKey = new PluginKey('commentHighlight');

interface CommentHighlightOptions {
  comments: Comment[];
  onSelectComment?: (commentId: string) => void;
}

const CommentHighlightExtension = Extension.create<CommentHighlightOptions>({
  name: 'commentHighlight',

  addOptions() {
    return {
      comments: [],
    };
  },

  addCommands() {
    return {
      setComments: (comments: Comment[]) => ({ tr, dispatch }: { tr: any; dispatch: any }) => {
        this.options.comments = comments;
        if (dispatch) {
          tr.setMeta('commentHighlight', comments);
        }
        return true;
      },
    } as any;
  },

  addProseMirrorPlugins() {
    const getComments = () => this.options.comments;
    return [
      new Plugin({
        key: CommentHighlightPluginKey,
        props: {
          decorations(state: EditorState) {
            const decorations: Decoration[] = [];
            const activeComments = getComments() || [];

            if (activeComments.length === 0) return DecorationSet.empty;

            state.doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text || '';
                activeComments.forEach(comment => {
                  if (comment.status === 'resolved') return; // only highlight open comments

                  let idx = text.indexOf(comment.anchorText);
                  while (idx !== -1) {
                    decorations.push(
                      Decoration.inline(
                        pos + idx,
                        pos + idx + comment.anchorText.length,
                        {
                          class: 'comment-highlight-mark bg-amber-500/15 border-b-2 border-dashed border-amber-500/50 cursor-pointer hover:bg-amber-500/30 transition-all duration-200',
                          'data-comment-id': comment.id,
                          title: comment.text
                        }
                      )
                    );
                    idx = text.indexOf(comment.anchorText, idx + 1);
                  }
                });
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

interface RichMarkdownEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  onMagicEdit?: (selectedText: string) => Promise<string | null>;
  aiSuggestion?: string | null;
  onAiSuggestionAccepted?: (suggestion: string) => void;
  onAiSuggestionDismissed?: () => void;
  onContextChange?: (text: string) => void;

  // Comments Props
  projectId?: string;
  fileName?: string;
  comments?: Comment[];
  onSaveComments?: (comments: Comment[]) => void;
  showCommentsPanel?: boolean;
  onToggleCommentsPanel?: (show: boolean) => void;
}

export default function RichMarkdownEditor({
  content,
  onChange,
  onMagicEdit,
  aiSuggestion = null,
  onAiSuggestionAccepted,
  onAiSuggestionDismissed,
  onContextChange,

  projectId,
  fileName,
  comments = [],
  onSaveComments,
  showCommentsPanel = false,
  onToggleCommentsPanel,
}: RichMarkdownEditorProps) {
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  // Inline composer state (Google Docs pattern — lives in the side panel, no modal)
  const [pendingComment, setPendingComment] = useState<{ anchorText: string; anchorIndex: number; text: string } | null>(null);
  const [discardWarning, setDiscardWarning] = useState<'new' | 'edit' | null>(null); // which action triggered discard prompt
  const pendingDiscardPayload = useRef<{ anchorText?: string; anchorIndex?: number; editId?: string; editText?: string } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastEmittedContext = useRef('');
  const { toast } = useToast();

  const handleSelectComment = useCallback((id: string) => {
    setSelectedCommentId(id);
    const element = document.getElementById(`comment-card-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const editor = useEditor({
    extensions: [
      TiptapMarkdown.configure({}),
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing… type / for commands',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      SlashCommandExtension,
      GhostTextExtension.configure({
        suggestion: aiSuggestion,
      }),
      CommentHighlightExtension.configure({
        comments: comments,
      }),
    ],
    content: '',
    onCreate({ editor: e }: { editor: Editor }) {
      if (content) {
        (e.commands as any).setContent(content, { emitUpdate: false, contentType: 'markdown' });
      }
    },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-4 py-8 bg-transparent border-0 shadow-none',
      },
      handleKeyDown: (_view: EditorView, event: KeyboardEvent) => {
        if (aiSuggestion) {
          if (event.key === 'Tab') {
            event.preventDefault();
            onAiSuggestionAccepted?.(aiSuggestion);
            return true;
          }
          if (event.key === 'Escape' || event.key === 'Backspace') {
            onAiSuggestionDismissed?.();
            return event.key === 'Escape';
          }
        }
        return false;
      },
      handleClick: (_view: EditorView, _pos: number, event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const commentHighlight = target.closest('.comment-highlight-mark');
        if (commentHighlight) {
          const commentId = commentHighlight.getAttribute('data-comment-id');
          if (commentId) {
            event.preventDefault();
            onToggleCommentsPanel?.(true);
            handleSelectComment(commentId);
            return true;
          }
        }

        const link = target.closest('a');
        if (link && link.href) {
          event.preventDefault();
          openUrl(link.href).catch(console.error);
          return true;
        }

        return false;
      },
    },
    onUpdate({ editor: e }: { editor: Editor }) {
      const markdown = e.getMarkdown();
      onChange(markdown);

      if (onContextChange) {
        const textToCursor = e.state.doc.textBetween(
          Math.max(0, e.state.selection.from - 500),
          e.state.selection.from,
          '\n'
        );
        if (textToCursor !== lastEmittedContext.current) {
          lastEmittedContext.current = textToCursor;
          onContextChange(textToCursor);
        }
      }
    },
    onSelectionUpdate({ editor: _e }: { editor: Editor }) {
      if (aiSuggestion) {
        onAiSuggestionDismissed?.();
      }
    }
  });

  // Sync ghost-text suggestions
  useEffect(() => {
    if (editor) {
      (editor as any).setOptions({
        ghostText: { suggestion: aiSuggestion },
      });
      editor.view.dispatch(editor.state.tr);
    }
  }, [aiSuggestion, editor]);

  // Sync comments highlights
  useEffect(() => {
    if (editor) {
      (editor.commands as any).setComments(comments);
    }
  }, [comments, editor]);

  // Sync external content changes
  useEffect(() => {
    if (!editor || !content) return;
    const current = editor.getMarkdown();
    if (content !== current) {
      (editor.commands as any).setContent(content, { emitUpdate: false, contentType: 'markdown' });
    }
  }, [content, editor]);

  // ── Inline composer (Google Docs pattern) ──

  const handleAddNewComment = (anchorText: string, anchorIndex: number) => {
    // If a pending (unsaved) composer is open with typed text, warn before discarding
    if (pendingComment && pendingComment.text.trim()) {
      pendingDiscardPayload.current = { anchorText, anchorIndex };
      setDiscardWarning('new');
      return;
    }
    // If an inline edit is active, warn before discarding
    if (editingCommentId && editingText.trim()) {
      pendingDiscardPayload.current = { anchorText, anchorIndex };
      setDiscardWarning('edit');
      return;
    }
    setEditingCommentId(null);
    setPendingComment({ anchorText, anchorIndex, text: '' });
    onToggleCommentsPanel?.(true);
    // Focus the textarea on next tick
    setTimeout(() => composerRef.current?.focus(), 50);
  };

  const handleConfirmPendingComment = () => {
    if (!pendingComment || !pendingComment.text.trim()) return;

    const newComment: Comment = {
      id: `c_${Date.now()}`,
      text: pendingComment.text.trim(),
      anchorText: pendingComment.anchorText,
      anchorIndex: pendingComment.anchorIndex,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    const updated = [...(comments || []), newComment];
    onSaveComments?.(updated);
    setPendingComment(null);

    telemetryApi.track('comment.created', {
      projectId,
      fileName,
      commentId: newComment.id
    }).catch(() => {});

    toast({ title: 'Comment Added' });
  };

  const handleDiscardPendingComment = () => {
    setPendingComment(null);
    setDiscardWarning(null);

    // Carry out the deferred action
    const payload = pendingDiscardPayload.current;
    pendingDiscardPayload.current = null;
    if (!payload) return;

    if (payload.editId !== undefined) {
      setEditingCommentId(payload.editId!);
      setEditingText(payload.editText ?? '');
    } else if (payload.anchorText !== undefined) {
      setPendingComment({ anchorText: payload.anchorText!, anchorIndex: payload.anchorIndex!, text: '' });
      onToggleCommentsPanel?.(true);
      setTimeout(() => composerRef.current?.focus(), 50);
    }
  };

  const handleCancelDiscard = () => {
    setDiscardWarning(null);
    pendingDiscardPayload.current = null;
    // Re-focus composer so user can keep writing
    setTimeout(() => composerRef.current?.focus(), 50);
  };

  const handleEditComment = (commentId: string, currentText: string) => {
    // If composer is open with typed text, warn
    if (pendingComment && pendingComment.text.trim()) {
      pendingDiscardPayload.current = { editId: commentId, editText: currentText };
      setDiscardWarning('edit');
      return;
    }
    setPendingComment(null);
    setEditingCommentId(commentId);
    setEditingText(currentText);
  };

  const handleSaveEditComment = (commentId: string) => {
    if (!editingText.trim()) return;
    const updated = comments.map(c => {
      if (c.id === commentId) {
        return { ...c, text: editingText.trim() };
      }
      return c;
    });
    onSaveComments?.(updated);
    setEditingCommentId(null);
    setEditingText('');
    toast({ title: 'Comment Updated' });
  };

  const handleDeleteComment = (commentId: string) => {
    const updated = comments.filter(c => c.id !== commentId);
    onSaveComments?.(updated);
    if (selectedCommentId === commentId) {
      setSelectedCommentId(null);
    }
    toast({ title: 'Comment Deleted' });
  };

  const handleToggleResolveComment = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const isResolving = comment.status === 'open';

    const updated = comments.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          status: (isResolving ? 'resolved' : 'open') as any,
          resolvedAt: isResolving ? new Date().toISOString() : undefined,
          resolvedBy: isResolving ? ('user' as any) : undefined
        };
      }
      return c;
    });

    onSaveComments?.(updated);

    if (isResolving) {
      telemetryApi.track('comment.resolved', {
        projectId,
        fileName,
        commentId,
        resolvedBy: 'user'
      }).catch(() => {});
      toast({ title: 'Comment Resolved', description: 'Marked resolved by User.' });
    } else {
      toast({ title: 'Comment Re-opened' });
    }
  };

  const handleAskAiToResolve = (comment: Comment) => {
    window.dispatchEvent(new CustomEvent('productos:resolve-comment', {
      detail: { projectId, fileName, comment }
    }));
    toast({ title: 'Sent to AI Chat', description: 'Resolution streamed inside Chat command deck.' });
  };

  const openComments = comments.filter(c => c.status === 'open');
  const resolvedComments = comments.filter(c => c.status === 'resolved');

  return (
    <div className="h-full flex overflow-hidden bg-transparent font-sans">

      {/* Editor Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {editor && (
          <EditorBubbleMenu
            editor={editor}
            onMagicEdit={onMagicEdit}
            onAddComment={handleAddNewComment}
          />
        )}

        <div className="flex-1 overflow-y-auto px-4" data-rich-editor-viewport="true">
          <div className="max-w-3xl mx-auto">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* ── Right margin panel: Google Docs–style comments ── */}
      {showCommentsPanel && (
        <div className="w-[300px] border-l border-border bg-background flex flex-col overflow-hidden shrink-0 hidden lg:flex">

          {/* Panel Header */}
          <div className="h-12 border-b border-border bg-muted/30 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Comments</span>
              {openComments.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/25">
                  {openComments.length}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => {
                // Guard: warn if composer has unsaved text
                if (pendingComment && pendingComment.text.trim()) {
                  if (!window.confirm('Discard unsaved comment?')) return;
                }
                setPendingComment(null);
                setDiscardWarning(null);
                onToggleCommentsPanel?.(false);
              }}
              title="Close comments panel"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Scrollable body */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">

              {/* ── Inline Comment Composer (appears at top when active) ── */}
              {pendingComment && (
                <div className="rounded-xl border-2 border-amber-500/50 bg-background shadow-sm flex flex-col overflow-hidden">
                  {/* Discard warning stripe */}
                  {discardWarning && (
                    <div className="bg-amber-500/10 border-b border-amber-500/25 px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground leading-tight">Discard this comment?</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">You have unsaved text that will be lost.</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={handleCancelDiscard}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded border border-border bg-background hover:bg-muted text-foreground transition-colors"
                        >
                          Keep
                        </button>
                        <button
                          onClick={handleDiscardPendingComment}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Composer header: anchor quote */}
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MessageSquarePlus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-[11px] font-bold text-foreground">New Comment</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground border-l-2 border-amber-500/50 pl-2 bg-muted/50 py-1 pr-1.5 rounded italic line-clamp-2 select-none">
                      "{pendingComment.anchorText}"
                    </div>
                  </div>

                  {/* Textarea */}
                  <div className="px-3 pb-2">
                    <Textarea
                      ref={composerRef}
                      value={pendingComment.text}
                      onChange={(e) => setPendingComment(prev => prev ? { ...prev, text: e.target.value } : null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          if (pendingComment.text.trim()) {
                            setDiscardWarning('new');
                          } else {
                            setPendingComment(null);
                          }
                          e.preventDefault();
                        }
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault();
                          handleConfirmPendingComment();
                        }
                      }}
                      placeholder="Add a comment…"
                      rows={3}
                      className="resize-none text-xs bg-muted/40 border-border focus-visible:ring-amber-500/40 placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Composer actions */}
                  <div className="px-3 pb-3 flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground/60 font-medium">⌘↵ to save · Esc to cancel</span>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-xs rounded-lg border border-border hover:bg-muted"
                        onClick={() => {
                          if (pendingComment.text.trim()) {
                            setDiscardWarning('new');
                            pendingDiscardPayload.current = null; // no follow-up action
                          } else {
                            setPendingComment(null);
                          }
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-600 text-white gap-1.5 disabled:opacity-40"
                        disabled={!pendingComment.text.trim()}
                        onClick={handleConfirmPendingComment}
                      >
                        <Send className="w-3 h-3" />
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Empty state ── */}
              {comments.length === 0 && !pendingComment && (
                <div className="flex flex-col items-center justify-center text-center p-6 pt-12 opacity-60 space-y-2 select-none">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/50 stroke-[1.5]" />
                  <h4 className="text-xs font-semibold text-foreground">No Comments Yet</h4>
                  <p className="text-[10px] text-muted-foreground leading-normal max-w-[180px]">
                    Select any text in the editor and click "Add Comment" to start.
                  </p>
                </div>
              )}

              {/* ── Open comment cards ── */}
              {openComments.map((comment) => {
                const isSelected = selectedCommentId === comment.id;
                const isEditing = editingCommentId === comment.id;

                return (
                  <div
                    key={comment.id}
                    id={`comment-card-${comment.id}`}
                    onClick={() => setSelectedCommentId(comment.id)}
                    className={`rounded-xl border p-3 transition-all duration-150 flex flex-col gap-2 cursor-pointer relative group
                      ${
                        isSelected
                          ? 'border-amber-500/60 bg-amber-500/5 shadow-sm'
                          : 'border-border bg-background hover:border-border/80 hover:bg-muted/20'
                      }`}
                  >
                    {/* Anchor quote */}
                    <div className="text-[10px] text-muted-foreground border-l-2 border-amber-500/40 pl-2 bg-muted/40 py-1 pr-1.5 rounded italic truncate select-none">
                      "{comment.anchorText}"
                    </div>

                    {/* Comment body / inline edit */}
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') { e.stopPropagation(); setEditingCommentId(null); }
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.stopPropagation(); handleSaveEditComment(comment.id); }
                          }}
                          rows={3}
                          className="resize-none text-xs bg-muted/40 border-border focus-visible:ring-amber-500/40"
                        />
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded border"
                            onClick={(e) => { e.stopPropagation(); setEditingCommentId(null); }}>
                            <X className="w-3 h-3" />
                          </Button>
                          <Button size="icon" className="h-6 w-6 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={(e) => { e.stopPropagation(); handleSaveEditComment(comment.id); }}>
                            <Check className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-foreground leading-relaxed select-text font-medium break-words">
                        {comment.text}
                      </p>
                    )}

                    {/* Actions row */}
                    <div className="flex items-center justify-between border-t border-border/30 pt-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!isEditing && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleEditComment(comment.id, comment.text); }}
                            className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                            className="p-1 rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleToggleResolveComment(comment.id); }}
                            className="p-1 rounded text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500" title="Resolve">
                            <CheckCircle2 className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleAskAiToResolve(comment); }}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all ml-1 flex items-center gap-1 text-[9px] font-bold">
                            <Sparkles className="w-2.5 h-2.5" /> Ask AI
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ── Resolved comments ── */}
              {resolvedComments.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1 pb-1 border-b border-border/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Resolved ({resolvedComments.length})
                  </div>
                  <div className="space-y-2 opacity-50">
                    {resolvedComments.map((comment) => (
                      <div key={comment.id}
                        className="rounded-lg border border-border bg-muted/20 p-2.5 flex flex-col gap-1.5">
                        <span className="text-[9px] line-through text-muted-foreground italic truncate">
                          "{comment.anchorText}"
                        </span>
                        <p className="text-xs text-muted-foreground line-through break-words">{comment.text}</p>
                        <div className="flex items-center justify-between border-t border-border/20 pt-1">
                          <span className="text-[8px] text-muted-foreground">
                            Resolved by {comment.resolvedBy === 'ai' ? 'AI' : 'User'}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleResolveComment(comment.id); }}
                            className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-0.5 text-[8px]"
                          >
                            <Undo2 className="w-2.5 h-2.5" /> Reopen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
