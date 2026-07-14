'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { ClientSubscriptionStatusList } from '~/home/[account]/_components/client-subscription-status-list';
import type { PhaseListItem } from '~/home/[account]/jobs/_lib/schema/project-phases.schema';
import { listJobs } from '~/home/[account]/jobs/_lib/server/server-actions';
import { deliveryProjectTitle } from '~/lib/projects/project-types';
import {
  WEBSITE_DESIGN_TEMPLATE,
  websitePlanningTabForPhase,
} from '~/lib/websites/website-design-template';

import { createWebsiteProject } from '../../_lib/server/site-studio-actions';
import { AttachHostingPlanButton } from '../attach-hosting-plan-button';

type JobOption = { id: string; label: string };

export function WebsiteDeliveryOverview({
  accountId,
  accountSlug,
  websiteId,
  clientName,
  clientHref,
  jobId,
  jobTitle,
  phases,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  websiteId: string;
  clientName: string | null;
  clientHref: string | null;
  jobId: string | null;
  jobTitle: string | null;
  phases: PhaseListItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkMode, setLinkMode] = useState(false);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [existingJobId, setExistingJobId] = useState('');

  const jobHref = jobId
    ? pathsConfig.app.accountJobDetail
        .replace('[account]', accountSlug)
        .replace('[id]', jobId)
    : null;

  const completedCount = phases.filter(
    (phase) => phase.status === 'complete',
  ).length;
  const overallPct =
    phases.length === 0
      ? 0
      : Math.round(
          phases.reduce((sum, phase) => sum + phase.progressPct, 0) /
            phases.length,
        );

  function loadJobs() {
    listJobs({
      accountId,
      tab: 'active',
      page: 1,
      pageSize: 100,
      query: undefined,
      status: undefined,
      priority: undefined,
    })
      .then((result) => {
        setJobs(
          (result.data ?? []).map((row) => ({
            id: String((row as { id?: unknown }).id ?? ''),
            label: deliveryProjectTitle(row),
          })),
        );
      })
      .catch(() => setJobs([]));
  }

  function createProject() {
    startTransition(async () => {
      try {
        const result = await createWebsiteProject({ accountId, websiteId });
        toast.success('Delivery project created with Website design phases');
        router.push(
          pathsConfig.app.accountJobDetail
            .replace('[account]', accountSlug)
            .replace('[id]', result.jobId),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create project',
        );
      }
    });
  }

  function linkProject() {
    if (!existingJobId) {
      toast.error('Pick a project to link');
      return;
    }
    startTransition(async () => {
      try {
        await createWebsiteProject({
          accountId,
          websiteId,
          existingJobId,
        });
        toast.success('Project linked');
        setLinkMode(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not link project',
        );
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Delivery
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Client and project linkage for the Website design workflow.
          </p>
        </div>
        {jobId ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {completedCount}/
            {phases.length || WEBSITE_DESIGN_TEMPLATE.phases.length} phases ·{' '}
            {overallPct}% progress
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Hosting billing
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Attach a recurring hosting plan. Cancel + recreate to change price
              (no prorations yet).
            </p>
          </div>
          <AttachHostingPlanButton
            accountId={accountId}
            websiteId={websiteId}
            canEdit={canEdit}
          />
        </div>
        <ClientSubscriptionStatusList
          accountId={accountId}
          websiteId={websiteId}
          canEdit={canEdit}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2">
          <p className="text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
            Client
          </p>
          {clientHref && clientName ? (
            <Link
              href={clientHref}
              className="text-sm font-medium text-[var(--ozer-accent)] hover:underline"
            >
              {clientName}
            </Link>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {clientName ??
                'No CRM client linked — edit the website to add one'}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2">
          <p className="text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
            Project
          </p>
          {jobHref ? (
            <Link
              href={jobHref}
              className="text-sm font-medium text-[var(--ozer-accent)] hover:underline"
            >
              {jobTitle ?? 'Open project'}
            </Link>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No delivery project yet
            </p>
          )}
        </div>
      </div>

      {jobId && phases.length > 0 ? (
        <ul className="space-y-2">
          {phases.map((phase) => {
            const tab = websitePlanningTabForPhase(phase.name);
            const planHref = tab
              ? `${pathsConfig.app.accountWebsiteDetail
                  .replace('[account]', accountSlug)
                  .replace('[id]', websiteId)}${
                  tab === 'overview' ? '' : `?plan=${tab}`
                }`
              : null;

            return (
              <li
                key={phase.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: phase.colour ?? 'var(--ozer-accent)',
                    }}
                  />
                  {planHref ? (
                    <Link
                      href={planHref}
                      className="font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent)]"
                    >
                      {phase.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-[var(--workspace-shell-text)]">
                      {phase.name}
                    </span>
                  )}
                  <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {phase.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                  {phase.progressPct}%
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!jobId && canEdit ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={createProject}
            >
              Create project from website
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setLinkMode((value) => !value);
                if (!linkMode) loadJobs();
              }}
            >
              Link existing project
            </Button>
          </div>
          {linkMode ? (
            <div className="flex flex-wrap items-end gap-2">
              <Select
                value={existingJobId || '__none__'}
                onValueChange={(value) =>
                  setExistingJobId(value === '__none__' ? '' : value)
                }
              >
                <SelectTrigger className="w-64 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select project…</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={linkProject}
              >
                Link project
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
