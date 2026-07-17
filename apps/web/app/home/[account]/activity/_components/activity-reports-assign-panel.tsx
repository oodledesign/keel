'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Check, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { assignUnassignedReportFilterAction } from '~/home/[account]/activity/_lib/server/activity-blocks-actions';
import type { ActivityReportsData } from '~/home/[account]/activity/_lib/server/activity-reports.loader';
import { ACTIVITY_REPORT_UNASSIGNED } from '~/lib/activity/activity-history';

type WorkClassification = 'billable' | 'internal' | 'neutral';

type Props = {
  data: ActivityReportsData;
};

function inferRuleMatch(
  appKey: string | null,
  appLabel: string | null,
): { matchType: 'domain' | 'app_name'; matchValue: string } | null {
  if (!appKey) {
    return null;
  }

  const separatorIndex = appKey.indexOf('|');
  if (separatorIndex !== -1) {
    return {
      matchType: 'domain',
      matchValue: appKey.slice(separatorIndex + 1),
    };
  }

  if (!appLabel) {
    return null;
  }

  return {
    matchType: 'app_name',
    matchValue: appLabel,
  };
}

export function ActivityReportsAssignPanel({ data }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState('none');
  const [clientId, setClientId] = useState('none');
  const [workClassification, setWorkClassification] =
    useState<WorkClassification>('neutral');
  const [rememberRule, setRememberRule] = useState(true);

  const hasNarrowFilter = Boolean(
    data.filters.appKey ||
    data.filters.clientId === ACTIVITY_REPORT_UNASSIGNED ||
    data.filters.projectId === ACTIVITY_REPORT_UNASSIGNED,
  );

  if (!data.canEdit || !hasNarrowFilter || data.unassignedInFilterCount === 0) {
    return null;
  }

  const appLabel =
    data.filters.appKey != null
      ? (data.apps.find((app) => app.key === data.filters.appKey)?.label ??
        null)
      : null;
  const ruleMatch = inferRuleMatch(data.filters.appKey, appLabel);
  const filterLabel = appLabel
    ? appLabel
    : data.filters.clientId === ACTIVITY_REPORT_UNASSIGNED
      ? 'unassigned clients'
      : data.filters.projectId === ACTIVITY_REPORT_UNASSIGNED
        ? 'unassigned projects'
        : 'this filter';

  function handleAssign() {
    if (projectId === 'none' && clientId === 'none') {
      toast.error('Choose a client or project');
      return;
    }

    startTransition(async () => {
      const result = await assignUnassignedReportFilterAction({
        accountId: data.accountId,
        accountSlug: data.accountSlug,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
        filters: data.filters,
        projectId: projectId === 'none' ? null : projectId,
        clientId: clientId === 'none' ? null : clientId,
        workClassification,
        rememberRule: rememberRule && ruleMatch != null,
        ruleMatch: ruleMatch ?? undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Could not assign sessions');
        return;
      }

      toast.success(
        `Assigned ${result.updated ?? 0} unassigned session${result.updated === 1 ? '' : 's'} for ${filterLabel}`,
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Assign from report
          </p>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {data.unassignedInFilterCount} unassigned session
            {data.unassignedInFilterCount === 1 ? '' : 's'} for {filterLabel} in
            this range.
          </p>
        </div>
        <Select value={clientId} onValueChange={setClientId} disabled={pending}>
          <SelectTrigger className="h-9 w-[10rem] bg-[var(--workspace-control-surface)] text-xs">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No client</SelectItem>
            {data.clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={projectId}
          onValueChange={setProjectId}
          disabled={pending}
        >
          <SelectTrigger className="h-9 w-[10rem] bg-[var(--workspace-control-surface)] text-xs">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {data.projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={workClassification}
          onValueChange={(value) =>
            setWorkClassification(value as WorkClassification)
          }
          disabled={pending}
        >
          <SelectTrigger className="h-9 w-[8.5rem] bg-[var(--workspace-control-surface)] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="billable">Billable</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
          </SelectContent>
        </Select>
        {ruleMatch ? (
          <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
            <Checkbox
              checked={rememberRule}
              onCheckedChange={(checked) => setRememberRule(checked === true)}
              disabled={pending}
            />
            Remember for future
          </label>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="ozer-gradient-btn"
          disabled={pending}
          onClick={handleAssign}
        >
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          )}
          Assign all
        </Button>
      </div>
    </div>
  );
}
