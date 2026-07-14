'use client';

import { useMemo } from 'react';

import { Check, MessageSquareWarning } from 'lucide-react';

import type { WebsiteApprovalRecord } from '../../_lib/server/website-approvals.service';

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function WebsiteApprovalFeed({
  approvals,
}: {
  approvals: WebsiteApprovalRecord[];
}) {
  const items = useMemo(() => approvals.slice(0, 24), [approvals]);

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Approval activity
        </p>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Client approve / request-changes from the portal or a public share
          link. Live status also shows on the sitemap canvas.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No approval activity yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => {
            const approved = row.action === 'approved';
            const label =
              row.targetLabel ??
              `${row.targetType === 'page' ? 'Page' : 'Section'}`;
            return (
              <li
                key={row.id}
                className="flex gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2.5"
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                    approved
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-amber-500/15 text-amber-800'
                  }`}
                >
                  {approved ? (
                    <Check className="size-3.5" />
                  ) : (
                    <MessageSquareWarning className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--workspace-shell-text)]">
                    <span className="font-medium capitalize">{row.actor}</span>{' '}
                    {approved ? 'approved' : 'requested changes on'}{' '}
                    <span className="font-medium">{label}</span>
                  </p>
                  {row.note ? (
                    <p className="mt-1 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
                      “{row.note}”
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
                    {formatWhen(row.createdAt)} · {row.targetType}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
