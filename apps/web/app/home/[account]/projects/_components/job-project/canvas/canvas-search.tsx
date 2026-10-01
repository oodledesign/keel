'use client';

import { type KeyboardEvent, useMemo, useRef, useState } from 'react';

import {
  ArrowRight,
  Building2,
  CheckSquare,
  FileText,
  Flag,
  Frame,
  GanttChart,
  Gauge,
  ImageIcon,
  Link2,
  type LucideIcon,
  NotebookText,
  PenLine,
  Search,
  Shapes,
  StickyNote,
  Type,
  User,
} from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@kit/ui/dialog';
import { cn } from '@kit/ui/utils';

import {
  type CanvasSearchEntry,
  searchCanvasEntries,
} from '~/lib/projects/canvas/canvas-search';
import type { CanvasItem } from '~/lib/projects/canvas/canvas-types';

import { CANVAS_KIND_LABELS } from './canvas-item-text';

const KIND_ICONS: Record<CanvasItem['kind'], LucideIcon> = {
  phase: Flag,
  task: CheckSquare,
  member: User,
  contact: User,
  client: Building2,
  note: NotebookText,
  doc: FileText,
  sticky: StickyNote,
  text: Type,
  shape: Shapes,
  frame: Frame,
  image: ImageIcon,
  link: Link2,
  draw: PenLine,
  connector: ArrowRight,
  timeline: GanttChart,
  metric: Gauge,
};

type CanvasSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: CanvasSearchEntry[];
  onPick: (id: string) => void;
};

export function CanvasSearchDialog({
  open,
  onOpenChange,
  entries,
  onPick,
}: CanvasSearchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] translate-y-0 gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-0 text-[var(--workspace-shell-text)] sm:max-w-lg [&>button]:hidden">
        <DialogTitle className="sr-only">Search the canvas</DialogTitle>
        {open ? (
          <SearchBody
            entries={entries}
            onPick={(id) => {
              onOpenChange(false);
              onPick(id);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SearchBody({
  entries,
  onPick,
}: {
  entries: CanvasSearchEntry[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(
    () => searchCanvasEntries(entries, query),
    [entries, query],
  );

  const move = (delta: number) => {
    if (results.length === 0) return;
    const next = (active + delta + results.length) % results.length;
    setActive(next);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = results[active];
      if (hit) onPick(hit.id);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search cards, notes, stickies, people…"
          className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--workspace-shell-text-muted)]"
          aria-label="Search the canvas"
        />
        <kbd className="rounded border border-[color:var(--workspace-shell-border)] px-1.5 py-0.5 text-[10px] text-[var(--workspace-shell-text-muted)]">
          Esc
        </kbd>
      </div>
      <div
        ref={listRef}
        role="listbox"
        aria-label="Results"
        className="max-h-[50vh] overflow-y-auto p-1.5"
      >
        {query.trim() === '' ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            Type to find anything on this canvas.
          </p>
        ) : results.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            Nothing matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          results.map((entry, index) => {
            const kind = entry.kind as CanvasItem['kind'];
            const Icon = KIND_ICONS[kind] ?? Search;
            return (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={index === active}
                data-index={index}
                onMouseMove={() => setActive(index)}
                onClick={() => onPick(entry.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm',
                  index === active &&
                    'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
                  {CANVAS_KIND_LABELS[kind] ?? entry.kind}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
