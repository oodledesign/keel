'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';

import { Plus } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  type ContentPost,
  type RoadmapColumn,
  type RoadmapZoom,
  addDays,
  columnIndexFor,
  columnPosition,
  contentStatus,
  formatDayMonth,
  noteKey,
  phaseBar,
  roadmapColumns,
  roadmapRange,
  todayYmd,
  weekStart,
} from '~/lib/projects/content/content-calendar';

import type {
  JobBoardTask,
  PhaseListItem,
} from '../../../_lib/schema/project-phases.schema';
import { PlatformDots } from './content-chips';
import { ContentPostDialog } from './content-post-dialog';
import { PeriodNote } from './period-note';
import type { ProjectContent } from './use-project-content';

const LABEL_W = 148;
const DONE = new Set(['done', 'completed', 'cancelled', 'canceled']);

type DialogTarget = { post: ContentPost } | { date: string } | null;

function Lane({
  label,
  hint,
  children,
  height,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <div
      className="flex border-b border-[color:var(--workspace-shell-border)]"
      style={height ? { minHeight: height } : undefined}
    >
      <div
        className="sticky left-0 z-20 shrink-0 border-r border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2"
        style={{ width: LABEL_W }}
      >
        <p className="text-[11px] font-semibold tracking-wide text-[var(--workspace-shell-text)] uppercase">
          {label}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[10px] text-[var(--workspace-shell-text-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Summary({
  title,
  lines,
}: {
  title: string;
  lines: Array<{ text: string; tone?: 'warn' | 'good' }>;
}) {
  return (
    <div className="min-w-[180px] flex-1 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
      <p className="text-[11px] font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {title}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs">
        {lines.map((line) => (
          <li
            key={line.text}
            className={cn(
              line.tone === 'warn' && 'font-medium text-[#991B1B]',
              line.tone === 'good' && 'text-[#166534]',
            )}
          >
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoadmapPanel({
  content,
  phases,
  tasks,
  canEdit,
  phaseHref,
  className,
  showSummary = true,
}: {
  content: ProjectContent;
  phases: PhaseListItem[];
  /** Every task on the board; subtasks are ignored. */
  tasks: JobBoardTask[];
  canEdit: boolean;
  phaseHref?: (phaseId: string) => string;
  className?: string;
  showSummary?: boolean;
}) {
  const today = todayYmd();
  const [zoom, setZoom] = useState<RoadmapZoom>('weeks');
  const [target, setTarget] = useState<DialogTarget>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const colW = zoom === 'weeks' ? 120 : 172;
  const topTasks = useMemo(
    () => tasks.filter((task) => !task.parent_task_id && task.due_date),
    [tasks],
  );

  const columns = useMemo(() => {
    const { from, to } = roadmapRange({
      today,
      dates: [
        ...phases.flatMap((phase) => [phase.start_date, phase.due_date]),
        ...topTasks.map((task) => task.due_date),
        ...content.posts.map((post) => post.postDate),
      ],
    });
    return roadmapColumns(from, to, zoom);
  }, [content.posts, phases, topTasks, today, zoom]);

  const trackW = columns.length * colW;
  const todayX = columnPosition(columns, today) * colW;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, todayX - 220);
    // Only re-centre when the zoom changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const groups = useMemo(() => {
    const result: Array<{ label: string; span: number }> = [];
    for (const column of columns) {
      const last = result[result.length - 1];
      if (last && last.label === column.group) last.span += 1;
      else result.push({ label: column.group, span: 1 });
    }
    return result;
  }, [columns]);

  const postsByColumn = useMemo(() => {
    const map = new Map<number, ContentPost[]>();
    for (const post of content.posts) {
      const index = columnIndexFor(columns, post.postDate);
      if (index < 0) continue;
      map.set(index, [...(map.get(index) ?? []), post]);
    }
    return map;
  }, [columns, content.posts]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<number, JobBoardTask[]>();
    for (const task of topTasks) {
      const index = columnIndexFor(columns, task.due_date!.slice(0, 10));
      if (index < 0) continue;
      map.set(index, [...(map.get(index) ?? []), task]);
    }
    return map;
  }, [columns, topTasks]);

  const gridStyle = {
    width: trackW,
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${colW - 1}px, var(--workspace-shell-border) ${colW - 1}px, var(--workspace-shell-border) ${colW}px)`,
  };

  const summaries = useMemo(() => {
    const thisWeek = weekStart(today);
    const ranges = [
      { title: 'This week', from: thisWeek, to: addDays(thisWeek, 7) },
      {
        title: 'Next week',
        from: addDays(thisWeek, 7),
        to: addDays(thisWeek, 14),
      },
      {
        title: 'Next 30 days',
        from: today,
        to: addDays(today, 30),
      },
    ];
    return ranges.map((range) => {
      const due = topTasks.filter((task) => {
        const date = task.due_date!.slice(0, 10);
        return date >= range.from && date < range.to;
      });
      const open = due.filter((task) => !DONE.has(task.status));
      const posts = content.posts.filter(
        (post) => post.postDate >= range.from && post.postDate < range.to,
      );
      const unscheduled = posts.filter(
        (post) => post.status === 'idea' || post.status === 'draft',
      );
      const active = phases.filter(
        (phase) =>
          phase.status === 'in_progress' ||
          (phase.start_date &&
            phase.due_date &&
            phase.start_date < range.to &&
            phase.due_date >= range.from &&
            phase.status !== 'complete'),
      );
      const lines: Array<{ text: string; tone?: 'warn' | 'good' }> = [
        {
          text: `${open.length} task${open.length === 1 ? '' : 's'} to finish${due.length - open.length > 0 ? ` (${due.length - open.length} done)` : ''}`,
        },
        {
          text: `${posts.length} post${posts.length === 1 ? '' : 's'}: ${posts.filter((post) => post.status === 'posted').length} posted, ${posts.filter((post) => post.status === 'scheduled').length} scheduled`,
        },
      ];
      if (unscheduled.length > 0) {
        lines.push({
          text: `${unscheduled.length} still to draft or schedule`,
          tone: 'warn',
        });
      }
      if (active.length > 0) {
        lines.push({
          text: `Phase: ${active
            .slice(0, 2)
            .map((phase) => phase.name)
            .join(', ')}${active.length > 2 ? ` +${active.length - 2}` : ''}`,
        });
      }
      return { title: range.title, lines };
    });
  }, [content.posts, phases, topTasks, today]);

  const milestones = phases.filter(
    (phase) => phase.is_milestone && phase.due_date,
  );
  const noteKind = zoom === 'weeks' ? 'week' : 'month';

  const add = (date: string) => canEdit && setTarget({ date });
  const columnDate = (column: RoadmapColumn) =>
    today >= column.start && today < column.end ? today : column.start;

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      {showSummary ? (
        <div className="flex flex-wrap gap-2">
          {summaries.map((summary) => (
            <Summary
              key={summary.title}
              title={summary.title}
              lines={summary.lines}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          One timeline for phases, tasks, content and notes. Scroll sideways;
          the line marks today.
        </p>
        <div className="flex overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)]">
          {(['weeks', 'months'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={zoom === option}
              onClick={() => setZoom(option)}
              className={cn(
                'nodrag px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                zoom === option
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scroller}
        className="nowheel min-h-0 overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
      >
        <div className="relative" style={{ width: LABEL_W + trackW }}>
          {/* Today line */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-[var(--ozer-accent)]"
            style={{ left: LABEL_W + todayX }}
            aria-hidden
          />

          {/* Header: months over weeks */}
          <div className="sticky top-0 z-30 border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
            <div className="flex">
              <div
                className="sticky left-0 z-40 shrink-0 bg-[var(--workspace-shell-sidebar-accent)]"
                style={{ width: LABEL_W }}
              />
              <div>
                <div className="flex">
                  {groups.map((group, index) => (
                    <div
                      key={`${group.label}-${index}`}
                      className="truncate border-r border-[color:var(--workspace-shell-border)] px-2 py-1 text-[11px] font-semibold text-[var(--workspace-shell-text)]"
                      style={{ width: group.span * colW }}
                    >
                      {group.label}
                    </div>
                  ))}
                </div>
                <div className="flex">
                  {columns.map((column) => (
                    <div
                      key={column.start}
                      className={cn(
                        'border-r border-[color:var(--workspace-shell-border)] px-2 py-1 text-[10px] text-[var(--workspace-shell-text-muted)]',
                        today >= column.start &&
                          today < column.end &&
                          'font-bold text-[var(--ozer-accent)]',
                      )}
                      style={{ width: colW }}
                    >
                      {zoom === 'weeks' ? `w/c ${column.label}` : column.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Phases */}
          <Lane label="Phases" hint={`${phases.length} in total`}>
            <div className="relative py-2" style={gridStyle}>
              {phases.length === 0 ? (
                <p className="px-3 py-1 text-xs text-[var(--workspace-shell-text-muted)]">
                  No phases yet.
                </p>
              ) : null}
              {phases.map((phase) => {
                const bar = phaseBar(columns, phase.start_date, phase.due_date);
                const colour = phase.colour || 'var(--ozer-accent)';
                const body = (
                  <span
                    className="relative flex h-6 items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold text-[var(--workspace-shell-text)]"
                    style={{
                      background: `color-mix(in srgb, ${colour} 22%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${colour} 55%, transparent)`,
                    }}
                    title={`${phase.name} · ${phase.progressPct}%${phase.description ? `\n${phase.description}` : ''}`}
                  >
                    <span
                      className="absolute inset-y-0 left-0 opacity-40"
                      style={{
                        width: `${phase.progressPct}%`,
                        background: colour,
                      }}
                    />
                    <span className="relative truncate">{phase.name}</span>
                  </span>
                );
                return (
                  <div key={phase.id} className="relative h-7">
                    {bar ? (
                      <div
                        className="absolute top-0.5"
                        style={{
                          left: bar.start * colW,
                          width: Math.max(24, (bar.end - bar.start) * colW),
                        }}
                      >
                        {phaseHref ? (
                          <Link href={phaseHref(phase.id)}>{body}</Link>
                        ) : (
                          body
                        )}
                      </div>
                    ) : (
                      <span className="absolute top-1.5 left-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
                        {phase.name} (no dates)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Lane>

          {/* Milestones */}
          <Lane label="Milestones" height={44}>
            <div className="relative" style={gridStyle}>
              {milestones.map((phase) => {
                const x = columnPosition(columns, phase.due_date!) * colW;
                return (
                  <div
                    key={phase.id}
                    className="absolute top-2 flex -translate-x-2 items-center gap-1.5"
                    style={{ left: x }}
                    title={`${phase.name} · ${formatDayMonth(phase.due_date!)}`}
                  >
                    <span
                      className="h-4 w-4 rotate-45 rounded-sm"
                      style={{
                        background: phase.colour || 'var(--ozer-accent)',
                      }}
                    />
                    <span className="text-[11px] font-medium whitespace-nowrap">
                      {phase.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </Lane>

          {/* Tasks due */}
          <Lane
            label="Tasks due"
            hint="Top-level tasks by due date"
            height={60}
          >
            <div className="flex" style={gridStyle}>
              {columns.map((column, index) => {
                const list = tasksByColumn.get(index) ?? [];
                const open = list.filter((task) => !DONE.has(task.status));
                const overdue = open.length > 0 && column.end <= today;
                return (
                  <div
                    key={column.start}
                    className="p-1.5"
                    style={{ width: colW }}
                  >
                    {list.length > 0 ? (
                      <span
                        className={cn(
                          'inline-flex flex-col rounded-md px-2 py-1 text-[11px] leading-tight font-medium',
                          overdue
                            ? 'bg-[#FEE2E2] text-[#991B1B]'
                            : open.length === 0
                              ? 'bg-[#DCFCE7] text-[#166534]'
                              : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]',
                        )}
                        title={list.map((task) => task.title).join('\n')}
                      >
                        <span>
                          {open.length === 0
                            ? `${list.length} done`
                            : `${open.length} due`}
                        </span>
                        {overdue ? <span>overdue</span> : null}
                        {open.length > 0 && list.length > open.length ? (
                          <span className="font-normal opacity-70">
                            {list.length - open.length} done
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Lane>

          {/* Content */}
          <Lane
            label="Content"
            hint={`${content.posts.length} post${content.posts.length === 1 ? '' : 's'}`}
            height={130}
          >
            <div className="flex" style={gridStyle}>
              {columns.map((column, index) => {
                const list = postsByColumn.get(index) ?? [];
                const shown = zoom === 'weeks' ? list.slice(0, 3) : [];
                return (
                  <div
                    key={column.start}
                    className="group flex flex-col gap-1 p-1.5"
                    style={{ width: colW }}
                  >
                    {zoom === 'weeks' ? (
                      <>
                        {shown.map((post) => {
                          const status = contentStatus(post.status);
                          return (
                            <button
                              key={post.id}
                              type="button"
                              onClick={() => setTarget({ post })}
                              title={`${post.postDate} · ${post.title} · ${status.label}`}
                              className="nodrag flex flex-col gap-0.5 rounded-md border-l-[3px] bg-[var(--workspace-shell-panel)] px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm ring-1 ring-[color:var(--workspace-shell-border)] hover:ring-[var(--ozer-accent)]"
                              style={{ borderLeftColor: status.fg }}
                            >
                              <span className="truncate font-medium">
                                {post.title}
                              </span>
                              <PlatformDots
                                platforms={post.platforms}
                                max={3}
                              />
                            </button>
                          );
                        })}
                        {list.length > shown.length ? (
                          <span className="text-[10px] text-[var(--workspace-shell-text-muted)]">
                            +{list.length - shown.length} more
                          </span>
                        ) : null}
                      </>
                    ) : list.length > 0 ? (
                      <span className="text-[11px]">
                        <strong>{list.length}</strong> post
                        {list.length === 1 ? '' : 's'}
                        <span className="block text-[10px] text-[var(--workspace-shell-text-muted)]">
                          {list.filter((p) => p.status === 'scheduled').length}{' '}
                          scheduled ·{' '}
                          {list.filter((p) => p.status === 'posted').length}{' '}
                          posted
                        </span>
                      </span>
                    ) : null}
                    {canEdit ? (
                      <button
                        type="button"
                        aria-label={`Add a post in ${column.label}`}
                        onClick={() => add(columnDate(column))}
                        className="nodrag mt-auto self-start rounded p-0.5 text-[var(--workspace-shell-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:opacity-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Lane>

          {/* Notes */}
          <Lane
            label={zoom === 'weeks' ? 'Week notes' : 'Month notes'}
            height={92}
          >
            <div className="flex" style={gridStyle}>
              {columns.map((column) => (
                <div key={column.start} className="p-1" style={{ width: colW }}>
                  <PeriodNote
                    value={
                      content.notesByKey.get(noteKey(noteKind, column.start))
                        ?.body ?? ''
                    }
                    placeholder="Add note"
                    canEdit={canEdit}
                    rows={4}
                    onSave={(body) =>
                      content.saveNote(noteKind, column.start, body)
                    }
                    className="min-h-[72px]"
                  />
                </div>
              ))}
            </div>
          </Lane>
        </div>
      </div>

      <ContentPostDialog
        target={target}
        canEdit={canEdit}
        onClose={() => setTarget(null)}
        onSave={content.savePost}
        onDelete={content.removePost}
      />
    </div>
  );
}
