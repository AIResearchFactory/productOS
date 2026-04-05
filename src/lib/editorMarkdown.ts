/**
 * editorMarkdown.ts
 * Utilities for converting between Tiptap editor content and raw markdown strings.
 * Uses @tiptap/markdown for serialization.
 */

import { Editor } from '@tiptap/react';

/**
 * Extracts the current markdown string from a Tiptap editor instance.
 * Falls back to an empty string if the editor or storage isn't ready.
 */
export function getMarkdownFromEditor(editor: Editor | null): string {
  if (!editor) return '';
  try {
    // In Tiptap v3 @tiptap/markdown, getMarkdown is augmented directly on the editor
    return (editor as any).getMarkdown?.() ?? '';
  } catch (e) {
    console.error('[editorMarkdown] Failed to serialize to markdown:', e);
    return '';
  }
}

/**
 * Returns a safe markdown string to use as initial Tiptap content.
 * Tiptap's Markdown extension accepts a markdown string directly as the `content` prop.
 * This utility ensures we never pass undefined/null.
 */
export function normalizeMarkdown(raw: string | undefined | null): string {
  if (!raw || raw.trim() === '') return '';
  return raw;
}

/**
 * Checks if the given string looks like it contains a markdown table.
 * Used to show a warning when tables are present (editing not fully supported in rich mode).
 */
export function containsMarkdownTable(markdown: string): boolean {
  return /^\|.+\|/m.test(markdown);
}
