'use client';

import { useEffect, useState } from 'react';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

type NoteMarkdownToolbarProps = {
  editor: Editor | null;
  className?: string;
};

function useMobileKeyboardOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const update = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setOffset(0);
        return;
      }

      const viewport = window.visualViewport;
      if (!viewport) {
        setOffset(0);
        return;
      }

      setOffset(
        Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
      );
    };

    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return offset;
}

export function NoteMarkdownToolbar({
  editor,
  className,
}: NoteMarkdownToolbarProps) {
  const keyboardOffset = useMobileKeyboardOffset();

  const btn = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    enabled = true,
  ) => (
    <button
      key={label}
      type="button"
      disabled={!editor || !enabled}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md transition-colors lg:h-8 lg:w-8',
        active
          ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
          : 'text-[var(--workspace-shell-text-muted)] hover:bg-white/6 hover:text-[var(--workspace-shell-text)]',
        (!editor || !enabled) && 'opacity-35',
      )}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => {
        event.preventDefault();
        if (!enabled) return;
        onClick();
      }}
    >
      {icon}
    </button>
  );

  return (
    <div
      className={cn(
        'z-50 flex items-center gap-0.5 bg-[var(--workspace-shell-canvas)]',
        'fixed inset-x-0 bottom-0 justify-around border-t border-[color:var(--workspace-shell-border)] px-3 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        'lg:static lg:z-auto lg:justify-start lg:border-t-0 lg:border-b lg:pb-1.5',
        className,
      )}
      style={{ bottom: keyboardOffset }}
      role="toolbar"
      aria-label="Formatting"
    >
      {btn(
        'Undo',
        false,
        () => editor?.chain().focus().undo().run(),
        <Undo2 className="h-4 w-4" />,
        editor?.can().undo() ?? false,
      )}
      {btn(
        'Redo',
        false,
        () => editor?.chain().focus().redo().run(),
        <Redo2 className="h-4 w-4" />,
        editor?.can().redo() ?? false,
      )}
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
