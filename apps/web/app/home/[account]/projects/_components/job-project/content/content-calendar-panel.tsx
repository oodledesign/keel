'use client';

import { useMemo, useState } from 'react';

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  type ContentPost,
  addDays,
  addMonths,
  contentStatus,
  daysInMonth,
  formatMonthTitle,
  formatWeekday,
  groupPostsByDate,
  monthGrid,
  monthStart,
  noteKey,
  todayYmd,
} from '~/lib/projects/content/content-calendar';

import { PlatformDots, StatusPill } from './content-chips';
import { ContentPostDialog } from './content-post-dialog';
import { PeriodNote } from './period-note';
import type { ProjectContent } from './use-project-content';

type View = 'month' | 'rows';
type DialogTarget = { post: ContentPost } | { date: string } | null;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function PostChip({
  post,
  onOpen,
}: {
  post: ContentPost;
  onOpen: (post: ContentPost) => void;
}) {
  const status = contentStatus(post.status);
  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      title={`${post.title} · ${status.label}`}
      className="nodrag flex w-full flex-col gap-0.5 rounded-md border-l-[3px] bg-[var(--workspace-shell-panel)] px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ring-1 ring-[color:var(--workspace-shell-border)] transition-colors hover:ring-[var(--ozer-accent)]"
      style={{ borderLeftColor: status.fg }}
    >
      <span className="truncate font-medium text-[var(--workspace-shell-text)]">
        {post.postTime ? `${post.postTime} ` : ''}
        {post.title}
      </span>
      <span className="flex items-center justify-between gap-1">
        <PlatformDots platforms={post.platforms} max={3} />
        <StatusPill status={post.status} className="px-1.5 py-0 text-[9px]" />
      </span>
    </button>
  );
}

export function ContentCalendarPanel({
  content,
  canEdit,
  className,
  compact,
}: {
  content: ProjectContent;
  canEdit: boolean;
  className?: string;
  /** Smaller type and spacing, for a card on the canvas. */
  compact?: boolean;
}) {
  const today = todayYmd();
  const [month, setMonth] = useState(monthStart(today));
  const [view, setView] = useState<View>('month');
  const [target, setTarget] = useState<DialogTarget>(null);

  const byDate = useMemo(
    () => groupPostsByDate(content.posts),
    [content.posts],
  );
  const noteFor = (kind: 'week' | 'month', start: string) =>
    content.notesByKey.get(noteKey(kind, start))?.body ?? '';

  const monthPosts = content.posts.filter(
    (post) => post.postDate.slice(0, 7) === month.slice(0, 7),
  );
  const counts = {
    scheduled: monthPosts.filter((post) => post.status === 'scheduled').length,
    posted: monthPosts.filter((post) => post.status === 'posted').length,
  };

  const open = (post: ContentPost) => setTarget({ post });
  const add = (date: string) => canEdit && setTarget({ date });

  const weeks = monthGrid(month);

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-heading min-w-[9rem] text-center text-base font-semibold">
            {formatMonthTitle(month)}
          </h3>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setMonth(monthStart(today))}
          >
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--workspace-shell-text-muted)]">
            {monthPosts.length} post{monthPosts.length === 1 ? '' : 's'} ·{' '}
            {counts.scheduled} scheduled · {counts.posted} posted
          </span>
          <div className="flex overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)]">
            {(['month', 'rows'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={cn(
                  'nodrag px-3 py-1.5 text-xs font-medium transition-colors',
                  view === option
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                {option === 'month' ? 'Month' : 'Month rows'}
              </button>
            ))}
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1"
              onClick={() => add(today)}
            >
              <Plus className="h-3.5 w-3.5" />
              Post
            </Button>
          ) : null}
        </div>
      </div>

      {content.failed ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-[var(--workspace-shell-text-muted)]">
          Could not load the content calendar.{' '}
          <button type="button" className="underline" onClick={content.reload}>
            Try again
          </button>
        </p>
      ) : null}

      {view === 'month' ? (
        <div className="min-h-0 overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <div className="min-w-[860px]">
            <PeriodNote
              value={noteFor('month', month)}
              placeholder={`Notes for ${formatMonthTitle(month)}: themes, campaigns, goals…`}
              canEdit={canEdit}
              rows={3}
              onSave={(body) => content.saveNote('month', month, body)}
              className="rounded-none border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/50"
            />
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(150px,1.1fr)] border-b border-[color:var(--workspace-shell-border)] text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-1.5">
                  {day}
                </div>
              ))}
              <div className="px-2 py-1.5">Week notes</div>
            </div>
            {weeks.map((week) => (
              <div
                key={week[0]!.ymd}
                className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(150px,1.1fr)] border-b border-[color:var(--workspace-shell-border)] last:border-b-0"
              >
                {week.map((day) => {
                  const posts = byDate.get(day.ymd) ?? [];
                  const isToday = day.ymd === today;
                  return (
                    <div
                      key={day.ymd}
                      className={cn(
                        'group relative flex min-h-[112px] flex-col gap-1 border-r border-[color:var(--workspace-shell-border)] p-1.5',
                        !day.inMonth &&
                          'bg-[var(--workspace-shell-sidebar-accent)]/40 opacity-60',
                        compact && 'min-h-[88px]',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                            isToday
                              ? 'bg-[var(--ozer-accent)] text-white'
                              : 'text-[var(--workspace-shell-text-muted)]',
                          )}
                        >
                          {Number(day.ymd.slice(8, 10))}
                        </span>
                        {canEdit ? (
                          <button
                            type="button"
                            aria-label={`Add a post on ${day.ymd}`}
                            onClick={() => add(day.ymd)}
                            className="nodrag rounded p-0.5 text-[var(--workspace-shell-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:opacity-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      {posts.map((post) => (
                        <PostChip key={post.id} post={post} onOpen={open} />
                      ))}
                    </div>
                  );
                })}
                <div className="p-1">
                  <PeriodNote
                    value={noteFor('week', week[0]!.ymd)}
                    placeholder="Week note"
                    canEdit={canEdit}
                    rows={4}
                    onSave={(body) =>
                      content.saveNote('week', week[0]!.ymd, body)
                    }
                    className="min-h-[96px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-0 space-y-4 overflow-auto">
          {[0, 1, 2].map((offset) => {
            const start = addMonths(month, offset);
            const total = daysInMonth(start);
            return (
              <section
                key={start}
                className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
              >
                <div className="grid gap-2 border-b border-[color:var(--workspace-shell-border)] p-2 md:grid-cols-[200px_1fr]">
                  <h4 className="font-heading px-2 pt-1 text-sm font-semibold">
                    {formatMonthTitle(start)}
                  </h4>
                  <PeriodNote
                    value={noteFor('month', start)}
                    placeholder="Month notes"
                    canEdit={canEdit}
                    rows={2}
                    onSave={(body) => content.saveNote('month', start, body)}
                  />
                </div>
                <div className="overflow-x-auto">
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${total}, minmax(128px, 1fr))`,
                      minWidth: total * 128,
                    }}
                  >
                    {Array.from({ length: total }, (_, index) => {
                      const ymd = addDays(start, index);
                      const posts = byDate.get(ymd) ?? [];
                      const weekend = [0, 6].includes(
                        new Date(`${ymd}T00:00:00Z`).getUTCDay(),
                      );
                      return (
                        <div
                          key={ymd}
                          className={cn(
                            'group flex min-h-[120px] flex-col gap-1 border-r border-[color:var(--workspace-shell-border)] p-1.5',
                            weekend &&
                              'bg-[var(--workspace-shell-sidebar-accent)]/40',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                'text-[11px] font-semibold',
                                ymd === today
                                  ? 'text-[var(--ozer-accent)]'
                                  : 'text-[var(--workspace-shell-text-muted)]',
                              )}
                            >
                              {formatWeekday(ymd)} {index + 1}
                            </span>
                            {canEdit ? (
                              <button
                                type="button"
                                aria-label={`Add a post on ${ymd}`}
                                onClick={() => add(ymd)}
                                className="nodrag rounded p-0.5 text-[var(--workspace-shell-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:opacity-100"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                          {posts.map((post) => (
                            <PostChip key={post.id} post={post} onOpen={open} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

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
