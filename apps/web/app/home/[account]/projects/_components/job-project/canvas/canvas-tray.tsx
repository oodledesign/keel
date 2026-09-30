'use client';

import {
  Building2,
  Contact,
  FileText,
  Layers,
  ListTodo,
  Plus,
  StickyNote,
  Users,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type { CanvasLinkedRef } from '~/lib/projects/canvas/canvas-layout';
import type { LinkedCanvasKind } from '~/lib/projects/canvas/canvas-types';

export const CANVAS_TRAY_DRAG_TYPE = 'application/x-project-canvas-ref';

export type CanvasTrayEntry = CanvasLinkedRef & { label: string };

const GROUPS: Array<{
  kind: LinkedCanvasKind;
  title: string;
  icon: typeof Users;
}> = [
  { kind: 'phase', title: 'Phases', icon: Layers },
  { kind: 'task', title: 'Tasks', icon: ListTodo },
  { kind: 'member', title: 'Team', icon: Users },
  { kind: 'client', title: 'Client', icon: Building2 },
  { kind: 'contact', title: 'Contacts', icon: Contact },
  { kind: 'note', title: 'Notes', icon: StickyNote },
  { kind: 'doc', title: 'Files & docs', icon: FileText },
];

export function CanvasTray({
  entries,
  onPlace,
  onPlaceAll,
  onClose,
}: {
  entries: CanvasTrayEntry[];
  onPlace: (entry: CanvasTrayEntry) => void;
  onPlaceAll: () => void;
  onClose: () => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] px-3 py-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Add from project
          </p>
          <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
            Drag onto the canvas or click to add.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--ozer-surface-panel)] hover:text-[var(--workspace-shell-text)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Everything in this project is on the canvas.
          </p>
        ) : (
          GROUPS.map(({ kind, title, icon: Icon }) => {
            const group = entries.filter((entry) => entry.kind === kind);
            if (group.length === 0) return null;
            return (
              <div key={kind} className="space-y-1">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--workspace-shell-text-muted)]">
                  <Icon className="h-3.5 w-3.5" />
                  {title} · {group.length}
                </p>
                <ul className="space-y-1">
                  {group.map((entry) => (
                    <li key={`${entry.kind}:${entry.refId}`}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            CANVAS_TRAY_DRAG_TYPE,
                            JSON.stringify({
                              kind: entry.kind,
                              refId: entry.refId,
                            }),
                          );
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => onPlace(entry)}
                        className={cn(
                          'flex w-full cursor-grab items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] px-2 py-1.5 text-left text-xs text-[var(--workspace-shell-text)] hover:border-[var(--ozer-accent)] active:cursor-grabbing',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {entry.label}
                        </span>
                        <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>

      {entries.length > 0 ? (
        <div className="border-t border-[color:var(--workspace-shell-border)] p-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={onPlaceAll}
          >
            Add all ({entries.length})
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
