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
import { Markdown } from '@tiptap/markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { open as openUrl } from '@tauri-apps/plugin-shell';

import EditorBubbleMenu from './EditorBubbleMenu';
import { SlashCommandExtension } from './SlashCommandMenu';
import { useEffect } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

interface RichMarkdownEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  onMagicEdit?: (selectedText: string) => Promise<string | null>;
}

export default function RichMarkdownEditor({
  content,
  onChange,
  onMagicEdit,
}: RichMarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      Markdown.configure({}),
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
    ],
    content: '', // Start empty to ensure onCreate handles the first setContent
    onCreate({ editor: e }) {
      if (content) {
        // Explicitly set contentType to 'markdown' so the markdown extension parses it
        (e.commands as any).setContent(content, { emitUpdate: false, contentType: 'markdown' });
      }
    },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-10 rounded-xl bg-background/50 border border-white/5 shadow-xl',
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        const link = target.closest('a');
        if (link && link.href) {
          event.preventDefault();
          // Open links externally via Tauri shell plugin
          openUrl(link.href).catch(console.error);
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: e }) {
      const markdown = e.getMarkdown();
      onChange(markdown);
    },
  });

  // Sync external content changes (e.g. switching documents)
  useEffect(() => {
    if (!editor || !content) return;
    const current = editor.getMarkdown();
    if (content !== current) {
      (editor.commands as any).setContent(content, { emitUpdate: false, contentType: 'markdown' });
    }
  }, [content, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {editor && <EditorBubbleMenu editor={editor} onMagicEdit={onMagicEdit} />}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
