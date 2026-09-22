'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import {
  PORTAL_SYNC_ISSUE_RECENCY_DAYS,
  type PortalSyncIssueSummary,
  formatPortalSyncIssueTime,
  portalCredentialWarningMessage,
  portalSyncPortalLabel,
} from '~/lib/commercial/portal-sync-issues';
import { workspacePanelCard } from '~/lib/workspace-ui';

function IssueTime({ iso }: { iso: string | null }) {
  if (!iso) return null;

  const relative = formatPortalSyncIssueTime(iso);
  if (!relative) return null;

  const absolute = new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <time
      dateTime={iso}
      title={absolute}
      className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]"
    >
      {relative}
    </time>
  );
}

export function PortalSyncIssuesCard({
  summary,
}: {
  summary: PortalSyncIssueSummary;
}) {
  const isClear = summary.issues.length === 0 && summary.warnings.length === 0;

  return (
    <Card className={workspacePanelCard}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Recent portal sync issues
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Last {PORTAL_SYNC_ISSUE_RECENCY_DAYS} days
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isClear ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No portal sync issues in the last {PORTAL_SYNC_ISSUE_RECENCY_DAYS}{' '}
            days.
          </p>
        ) : null}
        {summary.warnings.map((warning) => (
          <div
            key={warning.portal}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
          >
            <p className="text-sm text-[var(--workspace-shell-text)]">
              {portalCredentialWarningMessage(warning.portal, warning.count)}
            </p>
            {warning.sample.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-[var(--workspace-shell-text)]">
                  Show disposals
                  {warning.sampleTruncated
                    ? ` (${warning.sample.length} of ${warning.count})`
                    : ''}
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {warning.sample.map((issue) => (
                    <li
                      key={issue.id}
                      className="flex items-baseline justify-between gap-3 text-xs text-[var(--workspace-shell-text)]/80"
                    >
                      <span>{issue.listingName ?? 'Disposal'}</span>
                      <IssueTime iso={issue.lastSyncAt} />
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ))}

        {summary.issues.length > 0 ? (
          <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
            {summary.issues.map((issue) => (
              <li
                key={issue.id}
                className="space-y-0.5 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    {issue.listingName ?? 'Disposal'}
                    <span className="ml-1 font-normal text-[var(--workspace-shell-text)]/55">
                      · {portalSyncPortalLabel(issue.portal)}
                    </span>
                  </p>
                  <IssueTime iso={issue.lastSyncAt} />
                </div>
                <p className="text-xs text-rose-500">
                  <span className="capitalize">{issue.status}</span>
                  {issue.lastError ? ` — ${issue.lastError}` : null}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {summary.issuesTruncated ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Showing the {summary.issues.length} most recent listing failures.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
