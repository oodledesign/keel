import Link from 'next/link';

import { ArrowRight, ListChecks, Plus } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

import type {
  SopPlaybookListItem,
  SopRunListItem,
} from '../_lib/server/sops-data';

const panelClass =
  'rounded-[24px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

const recurrenceLabel: Record<string, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  project: 'Per project',
  ad_hoc: 'Ad hoc',
};

type SopsLibraryPageProps = {
  accountSlug: string;
  playbooks: SopPlaybookListItem[];
  recentRuns: SopRunListItem[];
};

export function SopsLibraryPage({
  accountSlug,
  playbooks,
  recentRuns,
}: SopsLibraryPageProps) {
  const newPath = pathsConfig.app.accountSopsPlaybookNew.replace(
    '[account]',
    accountSlug,
  );

  const byCategory = playbooks.reduce<Record<string, SopPlaybookListItem[]>>(
    (acc, pb) => {
      const key = pb.category?.trim() || 'General';
      acc[key] = acc[key] ?? [];
      acc[key].push(pb);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-8 px-4 py-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            Document repeatable processes once, then run them as checklists each
            month or project — your whole team follows the same steps.
          </p>
        </div>
        <Button asChild className="ozer-gradient-btn shrink-0 rounded-xl">
          <Link href={newPath}>
            <Plus className="mr-2 h-4 w-4" />
            New playbook
          </Link>
        </Button>
      </div>

      {playbooks.length === 0 ? (
        <div className={`${panelClass} px-6 py-12 text-center`}>
          <ListChecks className="text-muted-foreground mx-auto h-10 w-10" />
          <h2 className="mt-4 text-lg font-semibold text-[var(--workspace-shell-text)]">
            No playbooks yet
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            Create a playbook for web design handoffs, monthly SEO reporting, or
            any process your team repeats. Import existing docs with AI or build
            steps manually.
          </p>
          <Button asChild className="ozer-gradient-btn mt-6">
            <Link href={newPath}>Create your first playbook</Link>
          </Button>
        </div>
      ) : (
        Object.entries(byCategory).map(([category, items]) => (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              {category}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((pb) => (
                <Link
                  key={pb.id}
                  href={pathsConfig.app.accountSopsPlaybook
                    .replace('[account]', accountSlug)
                    .replace('[playbookId]', pb.id)}
                  className={`${panelClass} block p-5 transition-colors hover:border-[color:var(--workspace-shell-border)]`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-[var(--workspace-shell-text)]">
                      {pb.title}
                    </h3>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {recurrenceLabel[pb.recurrence] ?? pb.recurrence}
                    </Badge>
                  </div>
                  {pb.description ? (
                    <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                      {pb.description}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground mt-4 text-xs">
                    {pb.step_count} steps
                    {pb.active_runs > 0
                      ? ` · ${pb.active_runs} active run${pb.active_runs === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}

      {recentRuns.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Recent runs
          </h2>
          <div className={`${panelClass} divide-y divide-white/6`}>
            {recentRuns.map((run) => {
              const pct =
                run.total_steps > 0
                  ? Math.round((run.completed_steps / run.total_steps) * 100)
                  : 0;
              return (
                <Link
                  key={run.id}
                  href={pathsConfig.app.accountSopsRun
                    .replace('[account]', accountSlug)
                    .replace('[runId]', run.id)}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--workspace-shell-text)]">
                      {run.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {run.playbook_title}
                      {run.period_label ? ` · ${run.period_label}` : ''}
                      {run.assignee_name ? ` · ${run.assignee_name}` : ''}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-[var(--ozer-accent)]">{pct}%</p>
                    <p className="text-muted-foreground text-xs">
                      {run.completed_steps}/{run.total_steps}
                    </p>
                  </div>
                  <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
