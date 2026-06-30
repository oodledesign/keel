'use client';

import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  Underline,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  applyMarkdownFormat,
  type MarkdownFormat,
} from '~/lib/markdown-editor';

type NoteMarkdownToolbarProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  className?: string;
};

export function NoteMarkdownToolbar({
  textareaRef,
  onChange,
  className,
}: NoteMarkdownToolbarProps) {
  const apply = (format: MarkdownFormat) => {
    const node = textareaRef.current;
    if (!node) return;

    const { value, selectionStart, selectionEnd } = applyMarkdownFormat(
      node.value,
      node.selectionStart,
      node.selectionEnd,
      format,
    );

    onChange(value);

    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const btn = (label: string, format: MarkdownFormat, icon: React.ReactNode) => (
    <button
      key={format}
      type="button"
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-[var(--workspace-shell-text-muted)] transition-colors',
        'hover:bg-white/6 hover:text-[var(--workspace-shell-text)]',
      )}
      aria-label={label}
      title={label}
      onMouseDown={(event) => {
        event.preventDefault();
        apply(format);
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
      {btn('Bold', 'bold', <Bold className="h-4 w-4" />)}
      {btn('Italic', 'italic', <Italic className="h-4 w-4" />)}
      {btn('Underline', 'underline', <Underline className="h-4 w-4" />)}
      {btn('Bullet list', 'bullet', <List className="h-4 w-4" />)}
      {btn('Title', 'title', <Heading1 className="h-4 w-4" />)}
      {btn('Subheading', 'subheading', <Heading2 className="h-4 w-4" />)}
    </div>
  );
}
