import { cn } from '@kit/ui/utils';

import { noteMarkdownToHtml } from '~/lib/notes/note-markdown';

const noteMarkdownClasses = cn(
  'note-markdown-body text-base leading-relaxed',
  '[&_h1]:font-heading [&_h1]:mb-3 [&_h1]:text-[1.75rem] [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-tight',
  '[&_h2]:font-heading [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold',
  '[&_p]:mb-3 [&_p:last-child]:mb-0',
  '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_strong]:font-semibold',
  '[&_em]:italic',
  '[&_u]:underline',
);

type NoteMarkdownBodyProps = {
  markdown: string;
  className?: string;
  emptyLabel?: string;
};

export function NoteMarkdownBody({
  markdown,
  className,
  emptyLabel = 'No content.',
}: NoteMarkdownBodyProps) {
  const html = noteMarkdownToHtml(markdown);

  if (!html) {
    return (
      <p className={cn('text-sm text-[var(--workspace-shell-text-muted)]', className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div
      className={cn(noteMarkdownClasses, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
