'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { clientSubscriptionCheckoutHref } from '~/lib/billing/client-subscription-lifecycle';
import {
  clientSubscriptionStatusLabel,
  clientSubscriptionStatusStyles,
} from '~/lib/billing/client-subscription-status';
import type { ClientSubscriptionStatus } from '~/lib/billing/plan-templates-types';
import {
  type ClientProjectRetainerSummary,
  type ClientRetainerProjectChoice,
  type UnassignedClientRetainer,
  projectRetainerHref,
} from '~/lib/retainers/client-retainer-summary';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import { listClientRetainerSummaryAction } from '../_lib/server/client-retainer-summary-actions';
import { AddClientRetainerButton } from './add-client-retainer-button';

function StatusPill({ status }: { status: string }) {
  const key = (
    status in clientSubscriptionStatusStyles ? status : 'pending'
  ) as ClientSubscriptionStatus;
  const style = clientSubscriptionStatusStyles[key];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {clientSubscriptionStatusLabel(status)}
    </span>
  );
}

export function ClientRetainerSummary({
  accountId,
  accountSlug,
  clientId,
  clientName,
  canEdit,
  onViewProjects,
}: {
  accountId: string;
  accountSlug: string;
  clientId: string;
  clientName?: string;
  canEdit: boolean;
  onViewProjects: () => void;
}) {
  const [projects, setProjects] = useState<ClientProjectRetainerSummary[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedClientRetainer[]>([]);
  const [choices, setChoices] = useState<ClientRetainerProjectChoice[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listClientRetainerSummaryAction({ accountId, clientId })
      .then((data) => {
        if (cancelled) return;
        setProjects(data.projects);
        setUnassigned(data.unassigned);
        setChoices(data.choices);
        setLoaded(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoaded(true);
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not load project retainers',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, clientId]);

  if (!loaded) {
    return (
      <p className={`mt-4 text-sm ${workspaceTextMuted}`}>
        Loading project retainers…
      </p>
    );
  }

  const addButton = (
    <AddClientRetainerButton
      accountId={accountId}
      accountSlug={accountSlug}
      clientId={clientId}
      clientName={clientName}
      choices={choices}
      canEdit={canEdit}
      onViewProjects={onViewProjects}
    />
  );

  if (projects.length === 0 && unassigned.length === 0) {
    return (
      <div className="mt-4 space-y-3">
        <p className={`text-sm ${workspaceTextMuted}`}>
          No project retainers yet. Add a retainer on a project to attach a plan
          and manage credits there.
        </p>
        {canEdit ? (
          addButton
        ) : (
          <Button type="button" size="sm" onClick={onViewProjects}>
            View projects
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {canEdit ? <div className="flex justify-end">{addButton}</div> : null}
      <ul className="space-y-2">
        {projects.map((row) => (
          <li
            key={row.projectId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2.5"
            data-test="client-retainer-project"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                  {row.projectTitle}
                </p>
                {row.planStatus ? <StatusPill status={row.planStatus} /> : null}
              </div>
              <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
                {row.planName ?? 'No plan attached'}
                {row.creditBalance != null
                  ? ` · ${row.creditBalance} credits`
                  : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {row.canPay && row.subscriptionId ? (
                <Button asChild size="sm" variant="outline">
                  <a href={clientSubscriptionCheckoutHref(row.subscriptionId)}>
                    Pay
                  </a>
                </Button>
              ) : null}
              <Button asChild size="sm">
                <Link href={projectRetainerHref(accountSlug, row.projectId)}>
                  Open project retainer
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {unassigned.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
            Plans not linked to a project
          </p>
          <ul className="space-y-2">
            {unassigned.map((row) => (
              <li
                key={row.subscriptionId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {row.planName}
                    </p>
                    <StatusPill status={row.planStatus} />
                  </div>
                  <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
                    Manage this plan from a project retainer tab.
                  </p>
                </div>
                {row.canPay ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={clientSubscriptionCheckoutHref(row.subscriptionId)}
                    >
                      Pay
                    </a>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
