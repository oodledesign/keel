'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { BookOpen, Check, ListChecks, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { setSopTrackerVisible } from '~/home/[account]/sops/_lib/sop-tracker-session';
import {
  type MessengerActiveGuideDetail,
  type MessengerGuideRunSummary,
  loadMessengerGuidesAction,
} from '~/lib/support/messenger-guides.actions';

import { SopAssistChecklistPanel } from './sop-assist-checklist-panel';

type GuidesViewProps = {
  accountId: string | null;
};

function formatGuideDate(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function statusLabel(status: MessengerGuideRunSummary['status']) {
  if (status === 'active') return 'In progress';
  if (status === 'completed') return 'Completed';
  return 'Archived';
}

export function GuidesView({ accountId }: GuidesViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accountSlug, setAccountSlug] = useState<string | null>(null);
  const [runs, setRuns] = useState<MessengerGuideRunSummary[]>([]);
  const [active, setActive] = useState<MessengerActiveGuideDetail | null>(null);

  const refresh = useCallback(async () => {
    if (!accountId) {
      setRuns([]);
      setActive(null);
      setAccountSlug(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await loadMessengerGuidesAction({ accountId });
      setAccountSlug(payload.accountSlug);
      setRuns(payload.runs);
      setActive(payload.active);
    } catch {
      setRuns([]);
      setActive(null);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!accountId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <ListChecks className="h-8 w-8 text-[var(--workspace-shell-text-muted)]" />
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Open a team workspace
        </p>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Guided walkthroughs live on team accounts.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--workspace-shell-text-muted)]" />
      </div>
    );
  }

  const history = runs.filter((r) => r.id !== active?.run.id);
  const libraryHref = accountSlug
    ? pathsConfig.app.accountSops.replace('[account]', accountSlug)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-4 p-4">
        {active && accountSlug ? (
          <section className="overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
            <div className="border-b border-[color:var(--workspace-shell-border)] px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium tracking-wide text-[var(--ozer-accent)] uppercase">
                    Active guide
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
                    {active.run.title}
                  </p>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {active.playbookTitle}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-xs"
                  onClick={() => {
                    setSopTrackerVisible(accountId, active.run.id, true);
                    router.refresh();
                  }}
                >
                  Show chip
                </Button>
              </div>
            </div>
            <div className="p-2">
              <SopAssistChecklistPanel
                accountId={accountId}
                accountSlug={accountSlug}
                run={active.run}
                steps={active.steps}
                playbookSteps={active.playbookSteps}
                compact
                onUpdated={({ allDone }) => {
                  if (allDone) {
                    void refresh();
                  }
                }}
              />
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-6 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-[var(--workspace-shell-text-muted)]" />
            <p className="mt-2 text-sm font-medium text-[var(--workspace-shell-text)]">
              No guide in progress
            </p>
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Start a walkthrough from the Guides library.
            </p>
            {libraryHref ? (
              <Button asChild size="sm" className="mt-3">
                <Link href={libraryHref}>Browse guides</Link>
              </Button>
            ) : null}
          </div>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              History
            </h3>
            {libraryHref ? (
              <Link
                href={libraryHref}
                className="text-xs font-medium text-[var(--ozer-accent)] hover:underline"
              >
                All guides
              </Link>
            ) : null}
          </div>

          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-4 text-center text-xs text-[var(--workspace-shell-text-muted)]">
              Your past guides will show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {history.map((run) => {
                const href =
                  accountSlug &&
                  pathsConfig.app.accountSopsRun
                    .replace('[account]', accountSlug)
                    .replace('[runId]', run.id);

                const pct =
                  run.totalSteps > 0
                    ? Math.round((run.completedSteps / run.totalSteps) * 100)
                    : 0;

                const inner = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                          {run.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
                          {statusLabel(run.status)}
                          {run.status === 'completed' && run.completedAt
                            ? ` · ${formatGuideDate(run.completedAt)}`
                            : ` · ${formatGuideDate(run.createdAt)}`}
                        </p>
                      </div>
                      {run.status === 'completed' ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                      ) : (
                        <span className="shrink-0 text-[11px] font-medium text-[var(--workspace-shell-text-muted)]">
                          {pct}%
                        </span>
                      )}
                    </div>
                    {run.totalSteps > 0 ? (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--workspace-shell-canvas)]">
                        <div
                          className={cn(
                            'h-full rounded-full bg-[var(--ozer-accent)]',
                            run.status === 'completed' && 'opacity-80',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </>
                );

                return (
                  <li key={run.id}>
                    {href ? (
                      <Link
                        href={href}
                        className="block rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5 transition-colors hover:bg-[var(--workspace-shell-canvas)]"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
