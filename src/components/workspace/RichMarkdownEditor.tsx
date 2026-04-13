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
 *
 * Props:
 *  - content: initial markdown string
 *  - onChange(markdownString): called on every document change
 *  - aiSuggestion: ghost-text string or null (managed by parent)
 *  - onAiSuggestionAccepted(): parent must clear suggestion after accept
 *  - onAiSuggestionDismissed(): parent must clear suggestion after dismiss
 *  - onContextChange(text): called with plain-text context for AI completion
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown as TiptapMarkdown } from '@tiptap/markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { tauriApi } from '@/api/tauri';
import { Extension, Editor } from '@tiptap/core';
import { Plugin, PluginKey, EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';

import EditorBubbleMenu from './EditorBubbleMenu';
import { SlashCommandExtension } from './SlashCommandMenu';
import { useEffect, useRef } from 'react';

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
}

export default function RichMarkdownEditor({
  content,
  onChange,
  onMagicEdit,
  aiSuggestion = null,
  onAiSuggestionAccepted,
  onAiSuggestionDismissed,
  onContextChange,
}: RichMarkdownEditorProps) {
  const lastEmittedContext = useRef('');

  const editor = useEditor({
    extensions: [
      TiptapMarkdown.configure({}),
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { class: 'editor-link' },
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
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-10 rounded-xl bg-background/50 border border-white/5 shadow-xl',
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
            // Don't prevent default on Backspace, let it delete
            return event.key === 'Escape';
          }
        }
        return false;
      },
      handleClick: (_view: EditorView, _pos: number, event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const link = target.closest('a');
        if (link && link.href) {
          event.preventDefault();
          tauriApi.openUrl(link.href).catch(console.error);
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: e }: { editor: Editor }) {
      const markdown = e.getMarkdown();
      onChange(markdown);

      // Extract plain text context for AI
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
      // Dismiss suggestion on cursor move if it's not a direct result of typing
      if (aiSuggestion) {
        onAiSuggestionDismissed?.();
      }
    }
  });

  // Update extension when suggestion changes
  useEffect(() => {
    if (editor) {
      (editor as any).setOptions({
        ghostText: { suggestion: aiSuggestion },
      });
      // Force decoration re-render
      editor.view.dispatch(editor.state.tr);
    }
  }, [aiSuggestion, editor]);

  // Sync external content changes
  useEffect(() => {
    if (!editor || !content) return;
    const current = editor.getMarkdown();
    if (content !== current) {
      (editor.commands as any).setContent(content, { emitUpdate: false, contentType: 'markdown' });
    }
  }, [content, editor]);

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {editor && <EditorBubbleMenu editor={editor} onMagicEdit={onMagicEdit} />}

      <div className="flex-1 overflow-y-auto" data-rich-editor-viewport="true">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
