'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@kit/ui/utils';

type Props = {
  markdown: string;
};

const timeLineRe =
  /^(\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2})\s*·\s*(.+)$/;

export function PlanOutputRenderer({ markdown }: Props) {
  return (
    <div className="planner-markdown space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-xl font-bold tracking-tight text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => {
            const text = String(children);
            const muted =
              /not scheduled|deferred/i.test(text) || /notes/i.test(text);
            return (
              <h3
                className={cn(
                  'pt-3 text-sm font-semibold uppercase tracking-wide text-[#5eead4]',
                  muted && 'text-white/45',
                )}
              >
                {children}
              </h3>
            );
          },
          p: ({ children }) => {
            const text = String(children);
            return <PlanParagraph text={text}>{children}</PlanParagraph>;
          },
          li: ({ children }) => (
            <li className="ml-4 list-disc text-sm leading-relaxed text-white/60">
              {children}
            </li>
          ),
          ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function PlanParagraph({
  text,
  children,
}: React.PropsWithChildren<{ text: string }>) {
  const line = timeLineRe.exec(text.trim());
  if (line) {
    const [, time, body] = line;
    if (!time || !body) {
      return <p className="text-sm leading-relaxed text-white/70">{children}</p>;
    }
    const isCalendar = body.includes('📅');
    return (
      <p
        className={cn(
          'rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/80',
          isCalendar && 'border-sky-400/15 bg-sky-400/10 text-sky-100/85',
        )}
      >
        <span className="mr-2 font-mono text-xs text-white/45">{time}</span>
        <span>{body}</span>
      </p>
    );
  }

  if (/notes/i.test(text)) {
    return <p className="text-sm italic leading-relaxed text-white/55">{children}</p>;
  }

  return <p className="text-sm leading-relaxed text-white/70">{children}</p>;
}
