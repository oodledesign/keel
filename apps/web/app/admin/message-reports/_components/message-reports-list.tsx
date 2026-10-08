'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import type {
  AdminMessageReport,
  MessageReportStatus,
} from '../_lib/server/load-message-reports';
import { updateMessageReportStatusAction } from '../_lib/server/message-report-actions';

const STATUS_LABELS: Record<MessageReportStatus, string> = {
  open: 'Open',
  actioned: 'Actioned',
  dismissed: 'Dismissed',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

export function MessageReportsList({
  reports,
  filter,
}: {
  reports: AdminMessageReport[];
  filter: 'open' | 'all';
}) {
  const [rows, setRows] = useState(reports);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function setStatus(report: AdminMessageReport, status: MessageReportStatus) {
    setPendingId(report.id);
    startTransition(async () => {
      const result = await updateMessageReportStatusAction({
        reportId: report.id,
        status,
      });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((current) =>
        filter === 'open' && status !== 'open'
          ? current.filter((row) => row.id !== report.id)
          : current.map((row) =>
              row.id === report.id ? { ...row, status } : row,
            ),
      );
      toast.success(`Report marked ${STATUS_LABELS[status].toLowerCase()}`);
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {filter === 'open' ? 'No open reports.' : 'No reports yet.'}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((report) => {
        const overdue =
          report.status === 'open' && hoursSince(report.createdAt) >= 24;
        return (
          <li key={report.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{report.reasonLabel}</Badge>
              <Badge variant={report.status === 'open' ? 'default' : 'outline'}>
                {STATUS_LABELS[report.status]}
              </Badge>
              {overdue ? (
                <Badge variant="destructive">Over 24 hours</Badge>
              ) : null}
              <span className="text-muted-foreground ml-auto text-xs">
                {formatDateTime(report.createdAt)}
              </span>
            </div>

            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">
                  Reported person
                </dt>
                <dd>
                  {report.reported ? (
                    <>
                      <Link
                        href={`/admin/accounts/${report.reported.id}`}
                        className="font-medium hover:underline"
                      >
                        {report.reported.name}
                      </Link>
                      {report.reported.email ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · {report.reported.email}
                        </span>
                      ) : null}
                      {report.reported.reportCount > 1 ? (
                        <span className="text-destructive block text-xs">
                          Reported {report.reported.reportCount} times in total
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Not identified (group conversation)
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Reported by</dt>
                <dd>
                  <Link
                    href={`/admin/accounts/${report.reporter.id}`}
                    className="font-medium hover:underline"
                  >
                    {report.reporter.name}
                  </Link>
                  {report.reporter.email ? (
                    <span className="text-muted-foreground">
                      {' '}
                      ·{' '}
                      <a
                        href={`mailto:${report.reporter.email}`}
                        className="hover:underline"
                      >
                        {report.reporter.email}
                      </a>
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Workspace</dt>
                <dd>
                  <Link
                    href={`/admin/workspaces/${report.workspace.id}`}
                    className="hover:underline"
                  >
                    {report.workspace.name}
                  </Link>
                </dd>
              </div>
              {report.resolvedAt ? (
                <div>
                  <dt className="text-muted-foreground text-xs">Resolved</dt>
                  <dd>{formatDateTime(report.resolvedAt)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-3 space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">
                  {report.isConversationReport
                    ? 'Whole conversation reported'
                    : 'Reported message'}
                </p>
                {report.messageBody ? (
                  <blockquote className="bg-muted mt-1 rounded-md px-3 py-2 whitespace-pre-wrap">
                    {report.messageBody}
                  </blockquote>
                ) : null}
              </div>
              {report.details ? (
                <div>
                  <p className="text-muted-foreground text-xs">
                    Reporter&apos;s details
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{report.details}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {report.status === 'open' ? (
                <>
                  <Button
                    size="sm"
                    disabled={pendingId === report.id}
                    onClick={() => setStatus(report, 'actioned')}
                  >
                    Mark actioned
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === report.id}
                    onClick={() => setStatus(report, 'dismissed')}
                  >
                    Dismiss
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId === report.id}
                  onClick={() => setStatus(report, 'open')}
                >
                  Reopen
                </Button>
              )}
              {report.reported ? (
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/admin/accounts/${report.reported.id}`}>
                    Review or ban {report.reported.name}
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
