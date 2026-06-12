'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@kit/ui/utils';

import {
  splitScheduleSegments,
  type ScheduleSegment,
} from '~/lib/planner/parse-plan-markdown';

type Props = {
  markdown: string;
};

/** Flatten React children to plain text (String() would comma-join arrays). */
function textFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join('');
  }
  if (
    children &&
    typeof children === 'object' &&
    'props' in children &&
    children.props &&
    typeof children.props === 'object' &&
    'children' in children.props
  ) {
    return textFromChildren(children.props.children as React.ReactNode);
  }
  return '';
}

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
            const text = textFromChildren(children);
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
            const text = textFromChildren(children);
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
  const segments = splitScheduleSegments(text.trim());

  if (segments.length > 0) {
    return (
      <div className="space-y-1.5">
        {segments.map((segment, index) => (
          <ScheduleSegmentRow
            key={`${segment.timeLabel}-${index}`}
            segment={segment}
          />
        ))}
      </div>
    );
  }

  if (/notes/i.test(text)) {
    return (
      <p className="text-sm italic leading-relaxed text-white/55">{children}</p>
    );
  }

  return <p className="text-sm leading-relaxed text-white/70">{children}</p>;
}

const BREAK_TITLE_RE = /^(break|buffer|lunch|day wrap[\s-]?up|wind[\s-]?down)/i;

function ScheduleSegmentRow({ segment }: { segment: ScheduleSegment }) {
  const isBreak = !segment.isCalendarEvent && BREAK_TITLE_RE.test(segment.title);

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5',
        segment.isCalendarEvent && 'border-sky-400/15 bg-sky-400/10',
        isBreak && 'border-white/5 bg-white/[0.02]',
      )}
    >
      <span
        className={cn(
          'mt-0.5 shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[11px] leading-none tabular-nums',
          segment.isCalendarEvent ? 'text-sky-200/90' : 'text-[#5eead4]',
          isBreak && 'text-white/35',
        )}
      >
        {segment.timeLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium leading-snug',
            segment.isCalendarEvent
              ? 'text-sky-100/90'
              : isBreak
                ? 'text-white/45'
                : 'text-white/90',
          )}
        >
          {segment.isCalendarEvent ? '📅 ' : ''}
          {segment.title}
        </p>
        {segment.meta.length > 0 ? (
          <p className="mt-0.5 text-xs text-white/35">
            {segment.meta.join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
