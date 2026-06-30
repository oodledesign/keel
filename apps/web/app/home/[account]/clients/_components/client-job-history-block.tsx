'use client';

import { useCallback, useEffect, useState } from 'react';

import { Briefcase } from 'lucide-react';
import Link from 'next/link';

import { getJobHistory } from '../_lib/server/server-actions';

import pathsConfig from '~/config/paths.config';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

type JobRow = {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export function ClientJobHistoryBlock({
  accountSlug,
  accountId,
  clientId,
}: {
  accountSlug: string;
  accountId: string;
  clientId: string;
}) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJobHistory({ accountId, clientId });
      setJobs((data ?? []) as unknown as JobRow[]);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const jobDetailHref = pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', '');

  return (
    <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
      <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">Projects</h3>
      {loading ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No projects linked to this client yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`${jobDetailHref}${job.id}`}
                className="flex items-center gap-2 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm transition hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-panel-hover)]"
              >
                <Briefcase className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                <span className="min-w-0 flex-1 font-medium text-[var(--workspace-shell-text)]">
                  {job.title ?? 'Unnamed project'}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    job.status === 'completed' || job.status === 'cancelled'
                      ? 'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text-muted)]'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {STATUS_LABELS[job.status] ?? job.status}
                </span>
                <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
                  {new Date(job.created_at).toLocaleDateString('en-GB')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
