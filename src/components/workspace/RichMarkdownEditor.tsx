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

import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import EditorBubbleMenu from './EditorBubbleMenu';
import { SlashCommandExtension } from './SlashCommandMenu';
import { useEffect, useRef } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// Ghost Text Decoration Extension
// Renders AI suggestion as grey "ghost" text after the cursor,
// without inserting it into the document model.
// ────────────────────────────────────────────────────────────────────────────

const ghostTextPluginKey = new PluginKey('ghostText');

function createGhostTextPlugin(getSuggestion: () => string | null) {
  return new Plugin({
    key: ghostTextPluginKey,
    props: {
      decorations(state) {
        const suggestion = getSuggestion();
        if (!suggestion) return DecorationSet.empty;

        const { selection } = state;
        if (!selection.empty) return DecorationSet.empty;

        const pos = selection.anchor;

        const widget = Decoration.widget(pos, () => {
          const span = document.createElement('span');
          span.className = 'ghost-text-suggestion';
          span.textContent = suggestion;
          span.setAttribute('aria-hidden', 'true');
          return span;
        }, { side: 1 });

        return DecorationSet.create(state.doc, [widget]);
      },
    },
  });
}

function GhostTextExtension(getSuggestion: () => string | null) {
  return Extension.create({
    name: 'ghostText',
    addProseMirrorPlugins() {
      return [createGhostTextPlugin(getSuggestion)];
    },
    addKeyboardShortcuts() {
      return {
        Tab: () => {
          const suggestion = getSuggestion();
          if (!suggestion) return false;
          // Insert suggestion at current cursor position
          this.editor.chain().focus().insertContent(suggestion).run();
          // Signal parent to mark suggestion as accepted
          window.dispatchEvent(new CustomEvent('editor:accept-ghost-text'));
          return true; // consumed
        },
        Escape: () => {
          const suggestion = getSuggestion();
          if (!suggestion) return false;
          window.dispatchEvent(new CustomEvent('editor:dismiss-ghost-text'));
          return true;
        },
      };
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

interface RichMarkdownEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  aiSuggestion: string | null;
  onAiSuggestionAccepted: () => void;
  onAiSuggestionDismissed: () => void;
  onContextChange: (context: string) => void;
}

export default function RichMarkdownEditor({
  content,
  onChange,
  aiSuggestion,
  onAiSuggestionAccepted,
  onAiSuggestionDismissed,
  onContextChange,
}: RichMarkdownEditorProps) {
  // Keep a ref to latest suggestion so plugin closure reads fresh value
  const suggestionRef = useRef<string | null>(aiSuggestion);
  suggestionRef.current = aiSuggestion;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      Placeholder.configure({
        placeholder: 'Start writing… type / for commands',
      }),
      Markdown,
      SlashCommandExtension,
      GhostTextExtension(() => suggestionRef.current),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-8 py-6',
      },
    },
    onUpdate({ editor: e }) {
      // editor.getMarkdown() is augmented by @tiptap/markdown onto the Editor instance
      const markdown = e.getMarkdown();
      onChange(markdown);

      // Provide rolling context for AI completion (plain text)
      const text = e.getText();
      onContextChange(text);

      // Dismiss ghost text on any content change (user is typing)
      if (suggestionRef.current) {
        window.dispatchEvent(new CustomEvent('editor:dismiss-ghost-text'));
      }
    },
  });

  // Sync external content changes (e.g. switching documents)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getMarkdown();
    if (content !== current) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire ghost-text events to parent callbacks
  useEffect(() => {
    const handleDismiss = () => onAiSuggestionDismissed();
    const handleAccept = () => onAiSuggestionAccepted();
    window.addEventListener('editor:dismiss-ghost-text', handleDismiss);
    window.addEventListener('editor:accept-ghost-text', handleAccept);
    return () => {
      window.removeEventListener('editor:dismiss-ghost-text', handleDismiss);
      window.removeEventListener('editor:accept-ghost-text', handleAccept);
    };
  }, [onAiSuggestionDismissed, onAiSuggestionAccepted]);

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {editor && <EditorBubbleMenu editor={editor} />}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Ghost text badge — shown when suggestion is available */}
      {aiSuggestion && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium shadow-sm backdrop-blur-sm">
            <kbd className="font-sans">⇥</kbd> Tab to accept AI suggestion
          </span>
        </div>
      )}
    </div>
  );
}
