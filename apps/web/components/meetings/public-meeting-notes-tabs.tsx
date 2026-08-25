'use client';

import { useMemo, useState } from 'react';

import {
  Check,
  CheckSquare,
  Circle,
  Copy,
  FileText,
  Sparkles,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import { MeetingSummaryMarkdown } from '~/components/meetings/meeting-summary-markdown';
import { formatTranscriptTimestamp } from '~/lib/recorder/transcript-speakers';

export type PublicMeetingSpeakerSegment = {
  speaker: string;
  text: string;
  startMs?: number;
};

export type PublicMeetingTaskItem = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  completed: boolean;
};

type Props = {
  summaryText: string | null;
  content: string;
  speakerSegments: PublicMeetingSpeakerSegment[];
  panelClassName: string;
  showTasks?: boolean;
  tasks?: PublicMeetingTaskItem[];
};

function formatDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function buildTranscriptPlainText(
  speakerSegments: PublicMeetingSpeakerSegment[],
  content: string,
) {
  if (speakerSegments.length > 0) {
    return speakerSegments
      .map((segment) => {
        const time =
          typeof segment.startMs === 'number'
            ? `[${formatTranscriptTimestamp(segment.startMs)}] `
            : '';
        return `${time}${segment.speaker}\n${segment.text}`;
      })
      .join('\n\n');
  }
  return content.trim() || 'No transcript available.';
}

function buildTasksPlainText(tasks: PublicMeetingTaskItem[]) {
  if (tasks.length === 0) return '';
  return tasks
    .map((task) => {
      const parts = [
        `${task.completed ? '[x]' : '[ ]'} ${task.title}`,
        task.description?.trim() || null,
        task.dueDate ? `Due ${formatDueDate(task.dueDate)}` : null,
        task.completed ? 'Completed' : 'Open',
      ].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n\n');
}

export function PublicMeetingNotesTabs({
  summaryText,
  content,
  speakerSegments,
  panelClassName,
  showTasks = false,
  tasks = [],
}: Props) {
  const hasSummary = Boolean(summaryText?.trim());
  const [activeTab, setActiveTab] = useState(
    hasSummary ? 'summary' : 'transcript',
  );
  const [copied, setCopied] = useState(false);

  const transcriptText = useMemo(
    () => buildTranscriptPlainText(speakerSegments, content),
    [speakerSegments, content],
  );

  const tasksText = useMemo(() => buildTasksPlainText(tasks), [tasks]);

  const copyText =
    activeTab === 'summary' && summaryText?.trim()
      ? summaryText
      : activeTab === 'tasks'
        ? tasksText
        : transcriptText;
  const copyLabel =
    activeTab === 'summary'
      ? 'summary'
      : activeTab === 'tasks'
        ? 'tasks'
        : 'transcript';
  const canCopy = Boolean(copyText.trim());

  async function handleCopy() {
    if (!copyText.trim()) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={panelClassName}>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setCopied(false);
        }}
        className="gap-0"
      >
        <div className="mb-5 space-y-2">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-[var(--ozer-cream-50)] p-1 text-[var(--ozer-text-on-light-muted)]">
            {hasSummary ? (
              <TabsTrigger
                value="summary"
                className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-[var(--ozer-text-on-light)] data-[state=active]:shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                Summary
              </TabsTrigger>
            ) : null}
            <TabsTrigger
              value="transcript"
              className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-[var(--ozer-text-on-light)] data-[state=active]:shadow-sm"
            >
              <FileText className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
              Transcript
            </TabsTrigger>
            {showTasks ? (
              <TabsTrigger
                value="tasks"
                className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-[var(--ozer-text-on-light)] data-[state=active]:shadow-sm"
              >
                <CheckSquare className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                Tasks
                {tasks.length > 0 ? (
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ozer-text-on-light-muted)]">
                    {tasks.length}
                  </span>
                ) : null}
              </TabsTrigger>
            ) : null}
          </TabsList>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!canCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-2.5 py-1.5 text-xs font-medium text-[var(--ozer-plum-700)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={copied ? `${copyLabel} copied` : `Copy ${copyLabel}`}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {hasSummary && summaryText ? (
          <TabsContent value="summary" className="mt-0 outline-none">
            <MeetingSummaryMarkdown markdown={summaryText} variant="public" />
          </TabsContent>
        ) : null}

        <TabsContent value="transcript" className="mt-0 outline-none">
          <div className="max-h-[min(70vh,720px)] space-y-4 overflow-auto text-sm leading-relaxed text-[var(--ozer-text-on-light)]">
            {speakerSegments.length > 0 ? (
              speakerSegments.map((segment, index) => (
                <div key={`${segment.speaker}-${index}`}>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xs font-semibold tracking-wide text-[var(--ozer-text-on-light)] uppercase">
                      {segment.speaker}
                    </p>
                    {typeof segment.startMs === 'number' ? (
                      <span className="font-mono text-[11px] text-[var(--ozer-text-on-light-muted)] tabular-nums">
                        {formatTranscriptTimestamp(segment.startMs)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-normal whitespace-pre-wrap text-[var(--ozer-plum-700)]">
                    {segment.text}
                  </p>
                </div>
              ))
            ) : (
              <p className="font-normal whitespace-pre-wrap text-[var(--ozer-plum-700)]">
                {content || 'No transcript available.'}
              </p>
            )}
          </div>
        </TabsContent>

        {showTasks ? (
          <TabsContent value="tasks" className="mt-0 outline-none">
            {tasks.length > 0 ? (
              <ul className="space-y-3">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex gap-3 rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-3 py-3"
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[color:var(--ozer-border-on-light)] bg-white"
                      aria-hidden
                    >
                      {task.completed ? (
                        <CheckSquare className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                      ) : (
                        <Circle className="h-3 w-3 text-[var(--ozer-text-on-light-muted)]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          task.completed
                            ? 'text-sm font-medium text-[var(--ozer-text-on-light-muted)] line-through'
                            : 'text-sm font-medium text-[var(--ozer-text-on-light)]'
                        }
                      >
                        {task.title}
                      </p>
                      {task.description ? (
                        <p className="mt-1 text-sm leading-relaxed text-[var(--ozer-plum-700)]">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--ozer-text-on-light-muted)]">
                        {task.dueDate ? (
                          <span>Due {formatDueDate(task.dueDate)}</span>
                        ) : null}
                        <span>{task.completed ? 'Completed' : 'Open'}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                No accepted tasks from this meeting yet.
              </p>
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}
