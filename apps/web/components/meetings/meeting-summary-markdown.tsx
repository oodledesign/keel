'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@kit/ui/utils';

type Props = {
  markdown: string;
  className?: string;
  /** Light cream public pages vs workspace shell. */
  variant?: 'workspace' | 'public';
};

export function MeetingSummaryMarkdown({
  markdown,
  className,
  variant = 'workspace',
}: Props) {
  const isPublic = variant === 'public';
  const text = isPublic
    ? 'text-[var(--ozer-text-on-light)]'
    : 'text-[var(--workspace-shell-text)]';
  const body = isPublic
    ? 'text-[var(--ozer-plum-700)]'
    : 'text-[var(--workspace-shell-text)]';

  return (
    <div className={cn('meeting-summary-markdown space-y-3', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className={cn('text-base font-semibold tracking-tight', text)}>
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h2
              className={cn(
                'pt-1 text-sm font-semibold tracking-wide uppercase',
                text,
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn('text-sm font-semibold', text)}>{children}</h3>
          ),
          p: ({ children }) => (
            <p className={cn('text-sm leading-relaxed font-normal', body)}>
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1.5 pl-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>
          ),
          li: ({ children }) => (
            <li
              className={cn(
                'ml-4 list-disc text-sm leading-relaxed font-normal',
                body,
              )}
            >
              <span className={body}>{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className={cn('font-semibold', text)}>{children}</strong>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
