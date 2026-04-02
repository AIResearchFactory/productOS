/**
 * EditorBubbleMenu.tsx
 * Floating formatting toolbar that appears on text selection inside the Tiptap editor.
 * BubbleMenu is imported from @tiptap/extension-bubble-menu (not @tiptap/react).
 */

import { BubbleMenu } from '@tiptap/react/menus';
import { type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Link,
  List,
  ListOrdered,
  Quote,
  Code,
  PlusSquare,
  Columns,
  Trash2,
} from 'lucide-react';

interface EditorBubbleMenuProps {
  editor: Editor;
}

interface ToolbarButton {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  isActive: () => boolean;
  action: () => void;
  shouldShow?: () => boolean;
}

export default function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const buttons: ToolbarButton[] = [
    {
      label: 'Bold',
      icon: <Bold className="w-3.5 h-3.5" />,
      shortcut: '⌘B',
      isActive: () => editor.isActive('bold'),
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: <Italic className="w-3.5 h-3.5" />,
      shortcut: '⌘I',
      isActive: () => editor.isActive('italic'),
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Strikethrough',
      icon: <Strikethrough className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('strike'),
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: 'Inline Code',
      icon: <Code className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('code'),
      action: () => editor.chain().focus().toggleCode().run(),
    },
    // separator before headings (index 4)
    {
      label: 'Heading 1',
      icon: <Heading1 className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('heading', { level: 1 }),
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'Heading 2',
      icon: <Heading2 className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('heading', { level: 2 }),
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Heading 3',
      icon: <Heading3 className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('heading', { level: 3 }),
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    // separator before lists (index 7)
    {
      label: 'Bullet List',
      icon: <List className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('bulletList'),
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Ordered List',
      icon: <ListOrdered className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('orderedList'),
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Blockquote',
      icon: <Quote className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('blockquote'),
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Link',
      icon: <Link className="w-3.5 h-3.5" />,
      isActive: () => editor.isActive('link'),
      action: () => {
        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('Enter URL:', previousUrl ?? 'https://');
        if (url === null) return; // cancelled
        if (url === '') {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
          return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      },
    },
    // Table management buttons (only show if active)
    {
      label: 'Add Row',
      icon: <PlusSquare className="w-3.5 h-3.5" />,
      isActive: () => false, // never "active" in the toggle sense
      action: () => editor.chain().focus().addRowAfter().run(),
      shouldShow: () => editor.isActive('table'),
    },
    {
      label: 'Add Column',
      icon: <Columns className="w-3.5 h-3.5" />,
      isActive: () => false,
      action: () => editor.chain().focus().addColumnAfter().run(),
      shouldShow: () => editor.isActive('table'),
    },
    {
      label: 'Delete Table',
      icon: <Trash2 className="w-3.5 h-3.5 text-destructive" />,
      isActive: () => false,
      action: () => editor.chain().focus().deleteTable().run(),
      shouldShow: () => editor.isActive('table'),
    },
  ];

  // Indices where a separator appears BEFORE the button
  const separatorBefore = new Set([4, 7]);

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top' }}
      className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg shadow-black/20 px-1.5 py-1 backdrop-blur-md z-50"
    >
      {buttons.filter(btn => !btn.shouldShow || btn.shouldShow()).map((btn, idx) => (
        <span key={btn.label} className="flex items-center">
          {separatorBefore.has(idx) && (
            <span className="w-px h-4 bg-border mx-1" aria-hidden="true" />
          )}
          {/* separator before table buttons if they are shown */}
          {idx >= 11 && idx === buttons.findIndex(b => b.shouldShow && b.shouldShow()) && (
             <span className="w-px h-4 bg-border mx-1" aria-hidden="true" />
          )}
          <button
            type="button"
            aria-label={btn.label}
            title={btn.shortcut ? `${btn.label} (${btn.shortcut})` : btn.label}
            onClick={btn.action}
            className={`flex items-center justify-center w-7 h-7 rounded transition-colors
              ${btn.isActive()
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
          >
            {btn.icon}
          </button>
        </span>
      ))}
    </BubbleMenu>
  );
}
