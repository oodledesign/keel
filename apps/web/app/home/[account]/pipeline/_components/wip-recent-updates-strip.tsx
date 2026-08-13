'use client';

import { useMemo, useState } from 'react';

import { ChevronDown, ChevronUp, MessageSquareText } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

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

export function WipRecentUpdatesStrip({ items, onOpenInstruction }: Props) {
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(
    () => (expanded ? items : items.slice(0, 5)),
    [expanded, items],
  );

  if (items.length === 0) {
    return (
      <div
        className={`${workspacePanelCard} mx-4 flex items-center gap-2 px-3 py-2.5 md:mx-6 lg:mx-8`}
      >
        <MessageSquareText className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/35" />
        <p className={`text-sm ${workspaceTextMuted}`}>
          No recent chase updates yet — log what happened on an instruction
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 space-y-2 md:mx-6 lg:mx-8">
      <div className={`${workspacePanelCard} px-3 py-2.5`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquareText className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Recent updates
                <span className="ml-1.5 text-[var(--workspace-shell-text)]/55 tabular-nums">
                  {items.length}
                </span>
              </p>
              <p className={`hidden text-xs sm:block ${workspaceTextMuted}`}>
                What happened / what’s next across the desk
              </p>
            </div>
          </div>
          {items.length > 5 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 text-xs text-[var(--workspace-shell-text-muted)]"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  Show less
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show more
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          ) : null}
        </div>

        <ul className="divide-y divide-[color:var(--workspace-shell-border)]/70">
          {visible.map((item) => {
            const dealId = item.pipelineDealId;
            const canOpen = Boolean(dealId);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (dealId) onOpenInstruction(dealId);
                  }}
                  className="flex w-full flex-col gap-0.5 py-2 text-left transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]/50 disabled:cursor-default disabled:opacity-70 sm:flex-row sm:items-baseline sm:gap-3"
                >
                  <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)] tabular-nums sm:w-14">
                    {formatTimelineDate(item.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-[var(--workspace-shell-text)]">
                      {item.instructionTitle ?? 'Instruction'}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs ${workspaceTextMuted}`}
                    >
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
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
