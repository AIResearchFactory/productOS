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
  Sparkles,
  Trash2,
  CheckCircle2,
  X,
  Undo2,
  Edit2,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

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
}: RichMarkdownEditorProps) {
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
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
      (editor as any).setOptions({
        commentHighlight: { comments },
      });
      editor.view.dispatch(editor.state.tr);
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

  // Handle adding new comment from Selection Bubble Menu
  const handleAddNewComment = (anchorText: string, anchorIndex: number) => {
    const text = window.prompt(`Write comment on selected text "${anchorText}":`);
    if (!text || !text.trim()) return;

    const newComment: Comment = {
      id: `c_${Date.now()}`,
      text: text.trim(),
      anchorText,
      anchorIndex,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    const updated = [...(comments || []), newComment];
    onSaveComments?.(updated);

    telemetryApi.track('comment.created', {
      projectId,
      fileName,
      commentId: newComment.id
    }).catch(() => {});

    toast({ title: 'Comment Added', description: 'Inline comment registered in sidecar metadata.' });
  };

  const handleEditComment = (commentId: string, currentText: string) => {
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

      {/* Right margin panel for Word/Docs-style Comments */}
      <div className="w-[300px] border-l border-border bg-background/35 backdrop-blur-md flex flex-col overflow-hidden shrink-0 hidden lg:flex">
        {/* Panel Header */}
        <div className="h-12 border-b border-border bg-muted/20 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Inline Comments</span>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
            {openComments.length} Open
          </span>
        </div>

        {/* Scrollable list */}
        <ScrollArea className="flex-1 p-4">
          {comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60 space-y-2 mt-12 select-none">
              <MessageSquare className="w-8 h-8 text-muted-foreground/55 stroke-[1.5]" />
              <h4 className="text-xs font-semibold text-foreground">No Comments Yet</h4>
              <p className="text-[10px] text-muted-foreground leading-normal max-w-[180px]">
                Highlight any text inside the editor and select "Add Comment" to start collaboration.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Open Comments */}
              {openComments.map((comment) => {
                const isSelected = selectedCommentId === comment.id;
                const isEditing = editingCommentId === comment.id;

                return (
                  <div
                    key={comment.id}
                    id={`comment-card-${comment.id}`}
                    onClick={() => setSelectedCommentId(comment.id)}
                    className={`rounded-xl border p-3.5 transition-all duration-200 flex flex-col gap-2.5 cursor-pointer relative group
                      ${isSelected
                        ? 'border-amber-500/70 bg-amber-500/5 shadow-md shadow-amber-500/5'
                        : 'border-border bg-background/50 hover:border-border/80 hover:bg-muted/30'
                      }`}
                  >
                    {/* Anchor Snippet Quote */}
                    <div className="text-[10px] text-muted-foreground border-l-2 border-amber-500/40 pl-2 bg-muted/40 py-1.5 pr-1.5 rounded italic truncate select-none">
                      "{comment.anchorText}"
                    </div>

                    {/* Comment Body */}
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full min-h-[60px] rounded border border-border bg-muted p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded border hover:bg-muted"
                            onClick={(e) => { e.stopPropagation(); setEditingCommentId(null); }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            className="h-6 w-6 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={(e) => { e.stopPropagation(); handleSaveEditComment(comment.id); }}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-foreground leading-relaxed select-text font-medium break-words">
                        {comment.text}
                      </p>
                    )}

                    {/* Card Actions */}
                    <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-0.5">
                      <span className="text-[9px] text-muted-foreground font-semibold">
                        {new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!isEditing && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditComment(comment.id, comment.text); }}
                            className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Edit Comment"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                            className="p-1 rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                            title="Delete Comment"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleResolveComment(comment.id); }}
                            className="p-1 rounded text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
                            title="Resolve Comment"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAskAiToResolve(comment); }}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all ml-1.5 flex items-center gap-1 text-[9px] font-bold"
                            title="Ask AI to Resolve"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> Ask AI
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Resolved Comments Header / Dropdown */}
              {resolvedComments.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1 pb-1 border-b border-border/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Resolved Comments ({resolvedComments.length})
                  </div>
                  <div className="space-y-2 opacity-60">
                    {resolvedComments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-lg border border-border bg-secondary/20 p-2.5 flex flex-col gap-1.5 relative hover:opacity-100 transition-opacity"
                      >
                        <span className="text-[9px] line-through text-muted-foreground leading-normal italic truncate">
                          "{comment.anchorText}"
                        </span>
                        <p className="text-xs text-muted-foreground line-through break-words font-medium">
                          {comment.text}
                        </p>
                        <div className="flex items-center justify-between border-t border-border/20 pt-1.5 mt-0.5">
                          <span className="text-[8px] text-muted-foreground">
                            Resolved by {comment.resolvedBy === 'ai' ? 'AI' : 'User'}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleResolveComment(comment.id); }}
                            className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-0.5 text-[8px]"
                            title="Reopen Comment"
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
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
