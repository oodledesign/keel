'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { ExternalLink, Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import pathsConfig from '~/config/paths.config';
import { LISTING_STATUS_LABELS } from '~/lib/commercial/commercial-constants';
import type { RightmoveBulkJobPublic } from '~/lib/commercial/rightmove-bulk-job-types';
import {
  formatRightmovePublicationStatus,
  formatRightmoveUpdatedAt,
  type RightmoveDisposalStatusRow,
} from '~/lib/commercial/rightmove-publish-status';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  bulkPublishRightmoveAction,
  getRightmoveBulkJobStatusAction,
  listRightmoveDisposalStatusesAction,
} from '../_lib/server/server-actions';

function jobProgressLabel(job: RightmoveBulkJobPublic | null): string | null {
  if (!job) return null;
  if (job.total === 0) {
    return 'No Marketing / Under offer disposals to push';
  }
  if (job.isActive) {
    const current = job.lastListingName
      ? ` — ${job.lastListingName}`
      : '';
    return `Pushing ${job.processed} of ${job.total}${current}`;
  }
  if (job.status === 'completed') {
    if (job.failed === 0) {
      return `Pushed ${job.succeeded} of ${job.total} to Rightmove`;
    }
    return `Finished: ${job.succeeded} ok, ${job.failed} failed`;
  }
  if (job.status === 'failed') {
    return job.lastError ?? 'Bulk Rightmove publish failed';
  }
  return null;
}

export function RightmoveBulkPublishPanel({
  accountId,
  accountSlug,
  environment,
  portalPublishingUnlocked,
  oauthConfigured,
  branchConfigured,
  initialJob,
}: {
  accountId: string;
  accountSlug: string;
  environment: 'test' | 'production';
  portalPublishingUnlocked: boolean;
  oauthConfigured: boolean;
  branchConfigured: boolean;
  initialJob: RightmoveBulkJobPublic | null;
}) {
  const [job, setJob] = useState<RightmoveBulkJobPublic | null>(initialJob);
  const [startPending, startTransition] = useTransition();
  const [statusOpen, setStatusOpen] = useState(false);
  const [rows, setRows] = useState<RightmoveDisposalStatusRow[]>([]);
  const [rowsPending, startRowsTransition] = useTransition();

  useEffect(() => {
    setJob(initialJob);
  }, [initialJob]);

  useEffect(() => {
    if (!job?.isActive) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getRightmoveBulkJobStatusAction({
          accountId,
          resumeIfStale: true,
        });
        if (!cancelled) setJob(next.job);
      } catch {
        // Keep the last known snapshot; the next tick retries.
      }
    };

    const timer = window.setInterval(() => {
      void poll();
    }, 3000);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accountId, job?.id, job?.isActive]);

  const loadRows = () => {
    startRowsTransition(async () => {
      try {
        const result = await listRightmoveDisposalStatusesAction({ accountId });
        setRows(result.rows);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not load Rightmove status',
        );
      }
    });
  };

  const runBulk = () => {
    startTransition(async () => {
      try {
        const result = await bulkPublishRightmoveAction({ accountId });
        setJob(result.job);
        if (result.job.total === 0) {
          toast.message('No Marketing or Under offer disposals to push');
          return;
        }
        if (result.created) {
          toast.success(
            'Rightmove push started — you can leave this page; it keeps running',
          );
        } else {
          toast.message('A Rightmove push is already running');
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Bulk Rightmove publish failed',
        );
      }
    });
  };

  const progress = jobProgressLabel(job);
  const percent =
    job && job.total > 0
      ? Math.round((job.processed / job.total) * 100)
      : 0;

  const listingHref = (listingId: string) =>
    `${pathsConfig.app.accountListingDetail
      .replace('[account]', accountSlug)
      .replace('[id]', listingId)}/publishing`;

  const statusCounts = useMemo(() => {
    const published = rows.filter((row) => row.rightmoveStatus === 'published')
      .length;
    const failed = rows.filter((row) => row.rightmoveStatus === 'error').length;
    return { published, failed, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={
                startPending ||
                job?.isActive ||
                !portalPublishingUnlocked ||
                !oauthConfigured ||
                !branchConfigured
              }
            >
              {startPending || job?.isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {job?.isActive ? 'Pushing to Rightmove…' : 'Push all to Rightmove'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Push all disposals to Rightmove?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This sends every Marketing and Under offer disposal that has an
                office assigned to Rightmove (
                {environment === 'production' ? 'live' : 'test'} API). The job
                keeps running if you leave this page — come back here to see
                progress. Rightmove may take a short time to show listings
                publicly.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={startPending} onClick={runBulk}>
                Push all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={statusOpen}
          onOpenChange={(open) => {
            setStatusOpen(open);
            if (open) loadRows();
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              Rightmove status
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Rightmove disposals</DialogTitle>
              <DialogDescription>
                Status, listing URL, and last sync for every disposal in this
                workspace.
                {rows.length > 0
                  ? ` ${statusCounts.published} published, ${statusCounts.failed} failed, ${statusCounts.total} total.`
                  : null}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto">
              {rowsPending && rows.length === 0 ? (
                <p className="flex items-center gap-2 py-8 text-sm text-[var(--workspace-shell-text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading disposals…
                </p>
              ) : rows.length === 0 ? (
                <p className="py-8 text-sm text-[var(--workspace-shell-text-muted)]">
                  No disposals in this workspace yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Disposal</TableHead>
                      <TableHead>Rightmove</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Last updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const listingStatus =
                        LISTING_STATUS_LABELS[
                          row.listingStatus as keyof typeof LISTING_STATUS_LABELS
                        ] ?? row.listingStatus;
                      return (
                        <TableRow key={row.listingId}>
                          <TableCell>
                            <Link
                              href={listingHref(row.listingId)}
                              className="font-medium text-[var(--workspace-shell-text)] underline-offset-2 hover:underline"
                            >
                              {row.name}
                            </Link>
                            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                              {listingStatus}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-[var(--workspace-shell-text)]">
                              {formatRightmovePublicationStatus(
                                row.rightmoveStatus === 'none'
                                  ? null
                                  : row.rightmoveStatus,
                              )}
                            </p>
                            {row.lastError ? (
                              <p className="max-w-xs truncate text-xs text-rose-500">
                                {row.lastError}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {row.urls.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {row.urls.map((url) => (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-[var(--ozer-info)] underline-offset-2 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Open
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-[var(--workspace-shell-text-muted)]">
                            {formatRightmoveUpdatedAt(row.lastUpdatedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {job?.isActive ? (
        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
            <div
              className="h-full rounded-full bg-[var(--ozer-accent)] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-[var(--workspace-shell-text)]/55">
            {progress}
          </p>
        </div>
      ) : progress ? (
        <p className="text-xs text-[var(--workspace-shell-text)]/55">
          {progress}
        </p>
      ) : (
        <p className="text-xs text-[var(--workspace-shell-text)]/45">
          Bulk push covers Marketing / Under offer only. Each disposal needs an
          Office set on Management. Leaving this page does not stop a running
          push.
        </p>
      )}
    </div>
  );
}
