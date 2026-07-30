'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  Underline,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

type NoteMarkdownToolbarProps = {
  editor: Editor | null;
  className?: string;
};

export function NoteMarkdownToolbar({
  editor,
  className,
}: NoteMarkdownToolbarProps) {
  const btn = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      key={label}
      type="button"
      disabled={!editor}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
          : 'text-[var(--workspace-shell-text-muted)] hover:bg-white/6 hover:text-[var(--workspace-shell-text)]',
        !editor && 'opacity-50',
      )}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {icon}
    </button>
  );

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-0.5 border-b border-[color:var(--workspace-shell-border)] py-1.5',
        className,
      )}
      role="toolbar"
      aria-label="Formatting"
    >
      {btn(
        'Bold',
        editor?.isActive('bold') ?? false,
        () => editor?.chain().focus().toggleBold().run(),
        <Bold className="h-4 w-4" />,
      )}
      {btn(
        'Italic',
        editor?.isActive('italic') ?? false,
        () => editor?.chain().focus().toggleItalic().run(),
        <Italic className="h-4 w-4" />,
      )}
      {btn(
        'Underline',
        editor?.isActive('underline') ?? false,
        () => editor?.chain().focus().toggleUnderline().run(),
        <Underline className="h-4 w-4" />,
      )}
      {btn(
        'Bullet list',
        editor?.isActive('bulletList') ?? false,
        () => editor?.chain().focus().toggleBulletList().run(),
        <List className="h-4 w-4" />,
      )}
      {btn(
        'Title',
        editor?.isActive('heading', { level: 1 }) ?? false,
        () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
        <Heading1 className="h-4 w-4" />,
      )}
      {btn(
        'Subheading',
        editor?.isActive('heading', { level: 2 }) ?? false,
        () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        <Heading2 className="h-4 w-4" />,
      )}
    </div>
  );
}
