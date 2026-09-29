'use client';

import { useState } from 'react';

import { Bell } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';

import { workspaceTextMuted } from '~/lib/workspace-ui';

import type { WipDeskActivityItem } from '../_lib/server/wip-attachments.actions';

type Props = {
  items: WipDeskActivityItem[];
  onOpenInstruction: (pipelineDealId: string) => void;
};

function formatTimelineDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function previewText(content: string, max = 100) {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function formatCount(count: number) {
  return count > 9 ? '9+' : String(count);
}

/**
 * Toolbar bell. Opens a notification-style dropdown of the latest chase
 * updates across the desk; picking one opens that instruction.
 */
export function WipRecentUpdatesBell({ items, onOpenInstruction }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]/80"
          aria-label={
            items.length > 0
              ? `Recent updates (${items.length})`
              : 'Recent updates'
          }
          title="Recent updates"
          data-test="wip-recent-updates-button"
        >
          <Bell className="h-4 w-4" />
          {items.length > 0 ? (
            <span
              aria-hidden
              className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ozer-accent)] px-1 text-[10px] leading-none font-semibold text-[var(--ozer-white)] tabular-nums"
            >
              {formatCount(items.length)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        data-test="wip-recent-updates-dropdown"
        // Picking an update opens the instruction dialog, which takes focus.
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)]"
      >
        <div className="border-b border-[color:var(--workspace-shell-border)] px-3 py-2.5">
          <p className="text-sm font-medium">
            Recent updates
            {items.length > 0 ? (
              <span className="ml-1.5 text-[var(--workspace-shell-text)]/55 tabular-nums">
                {items.length}
              </span>
            ) : null}
          </p>
          <p className={`text-xs ${workspaceTextMuted}`}>
            What happened / what’s next across the desk
          </p>
        </div>

        {items.length === 0 ? (
          <p className={`px-3 py-6 text-center text-sm ${workspaceTextMuted}`}>
            No recent chase updates yet — log what happened on an instruction
          </p>
        ) : (
          <ul className="max-h-[min(26rem,60vh)] divide-y divide-[color:var(--workspace-shell-border)]/70 overflow-y-auto">
            {items.map((item) => {
              const dealId = item.pipelineDealId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!dealId}
                    onClick={() => {
                      if (!dealId) return;
                      setOpen(false);
                      onOpenInstruction(dealId);
                    }}
                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]/50 disabled:cursor-default disabled:opacity-70"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {item.instructionTitle ?? 'Instruction'}
                      </span>
                      <span
                        className={`shrink-0 text-[11px] tabular-nums ${workspaceTextMuted}`}
                      >
                        {formatTimelineDate(item.createdAt)}
                      </span>
                    </span>
                    <span className={`block text-xs ${workspaceTextMuted}`}>
                      {item.createdBy?.name ?? 'Member'}
                      {item.assignedTo ? (
                        <span> → {item.assignedTo.name}</span>
                      ) : null}
                      {item.content.trim() ? (
                        <span>
                          {' · '}
                          {previewText(item.content)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
