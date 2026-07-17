'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Ban, Check, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  createActivityRuleAction,
  excludeActivityBlockAction,
  updateActivityBlockAction,
} from '~/home/[account]/activity/_lib/server/activity-blocks-actions';
import type { ActivityPageData } from '~/home/[account]/activity/_lib/server/activity-page.loader';
import {
  type ActivityRuleMatch,
  activityRuleMatchKey,
  findActivityRuleMatchByKey,
  getActivityRuleMatchOptions,
} from '~/lib/activity/activity-app-context';
import type { ActivityBlockListRow } from '~/lib/activity/activity-history';

export type WorkClassification = 'billable' | 'internal' | 'neutral';

const WORK_CLASSIFICATION_LABELS: Record<WorkClassification, string> = {
  neutral: 'Neutral',
  billable: 'Billable',
  internal: 'Internal',
};

export function WorkClassificationBadge({
  classification,
}: {
  classification?: WorkClassification;
}) {
  if (!classification || classification === 'neutral') {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded px-1 py-0.5 text-[9px] font-medium tracking-wide uppercase',
        classification === 'billable'
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
      )}
    >
      {WORK_CLASSIFICATION_LABELS[classification]}
    </span>
  );
}

export function ActivityAssignmentDisplay({
  block,
  interactive = false,
}: {
  block: ActivityBlockListRow;
  interactive?: boolean;
}) {
  const hasAssignment = Boolean(block.clientName || block.projectName);

  if (!hasAssignment) {
    return (
      <span
        className={cn(
          'text-xs text-[var(--workspace-shell-text-muted)]',
          interactive && 'underline-offset-2 group-hover:underline',
        )}
      >
        Assign client or project
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <span
        className="flex items-center gap-1 truncate text-xs font-medium text-[var(--workspace-shell-text)]"
        title={block.clientName ?? undefined}
      >
        {block.isConfirmed ? (
          <Check
            className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-label="Confirmed"
          />
        ) : null}
        {block.clientName ?? 'No client'}
        <WorkClassificationBadge classification={block.workClassification} />
      </span>
      <span
        className="block truncate text-[10px] text-[var(--workspace-shell-text-muted)]"
        title={block.projectName ?? undefined}
      >
        {block.projectName ?? 'No project'}
      </span>
    </div>
  );
}

export function ActivityRememberRuleSelector({
  options,
  selectedKey,
  onSelectedKeyChange,
  rememberRule,
  onRememberRuleChange,
  disabled = false,
}: {
  options: ActivityRuleMatch[];
  selectedKey: string;
  onSelectedKeyChange: (key: string) => void;
  rememberRule: boolean;
  onRememberRuleChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const selectedRule =
    findActivityRuleMatchByKey(options, selectedKey) ?? options[0];

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
        <Checkbox
          checked={rememberRule}
          onCheckedChange={(checked) => onRememberRuleChange(checked === true)}
          disabled={disabled}
        />
        <span>Remember for future sessions</span>
      </label>
      {rememberRule ? (
        options.length > 1 ? (
          <Select
            value={selectedKey}
            onValueChange={onSelectedKeyChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 bg-[var(--workspace-control-surface)] text-xs">
              <SelectValue placeholder="Choose what to remember" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={activityRuleMatchKey(option)}
                  value={activityRuleMatchKey(option)}
                >
                  <span className="block truncate">
                    {option.description}: {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="pl-6 text-xs text-[var(--workspace-shell-text-muted)]">
            {selectedRule?.description}:{' '}
            <strong className="text-[var(--workspace-shell-text)]">
              {selectedRule?.label}
            </strong>
          </p>
        )
      ) : null}
    </div>
  );
}

type AssignmentCellProps = {
  block: ActivityBlockListRow;
  canEdit: boolean;
  projects: ActivityPageData['projects'];
  clients: ActivityPageData['clients'];
  accountId: string;
  accountSlug: string;
  onUpdated: (block: ActivityBlockListRow) => void;
  triggerClassName?: string;
  popoverAlign?: 'start' | 'center' | 'end';
};

export function ActivityBlockAssignmentCell({
  block,
  canEdit,
  projects,
  clients,
  accountId,
  accountSlug,
  onUpdated,
  triggerClassName,
  popoverAlign = 'start',
}: AssignmentCellProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(block.projectId ?? 'none');
  const [clientId, setClientId] = useState(block.clientId ?? 'none');
  const [workClassification, setWorkClassification] =
    useState<WorkClassification>(block.workClassification ?? 'neutral');
  const [rememberRule, setRememberRule] = useState(true);
  const ruleOptions = useMemo(
    () => getActivityRuleMatchOptions(block),
    [block],
  );
  const [selectedRuleKey, setSelectedRuleKey] = useState('');
  const selectedRule = findActivityRuleMatchByKey(ruleOptions, selectedRuleKey);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProjectId(block.projectId ?? 'none');
    setClientId(block.clientId ?? 'none');
    setWorkClassification(block.workClassification ?? 'neutral');

    const nextOptions = getActivityRuleMatchOptions(block);
    const preferredDomain = nextOptions.find(
      (option) => option.level === 'domain',
    );
    const defaultOption = preferredDomain ?? nextOptions[0];

    if (defaultOption) {
      setSelectedRuleKey(activityRuleMatchKey(defaultOption));
    }
  }, [open, block]);

  async function maybeCreateRule(
    nextProjectId: string | null,
    nextClientId: string | null,
  ): Promise<boolean> {
    if (!rememberRule || !selectedRule) {
      return false;
    }

    if (!nextProjectId && !nextClientId) {
      return false;
    }

    const result = await createActivityRuleAction({
      accountId,
      accountSlug,
      matchType: selectedRule.matchType,
      matchValue: selectedRule.matchValue,
      projectId: nextProjectId,
      clientId: nextClientId,
      backfill: true,
    });

    if (!result.success) {
      toast.error(result.error ?? 'Could not save rule');
      return false;
    }

    if (result.backfilled && result.backfilled > 0) {
      toast.success(
        `Saved rule for ${selectedRule.label} and updated ${result.backfilled} matching sessions`,
      );
    } else {
      toast.success(`Saved rule for ${selectedRule.label}`);
    }

    if (result.error) {
      toast.warning(result.error);
    }

    return true;
  }

  function runAction(
    action: () => Promise<{ success: boolean; error?: string }>,
    nextBlock: ActivityBlockListRow,
    options?: {
      projectId?: string | null;
      clientId?: string | null;
    },
  ) {
    startTransition(async () => {
      const result = await action();

      if (!result.success) {
        toast.error(result.error ?? 'Update failed');
        return;
      }

      const ruleSaved = await maybeCreateRule(
        options?.projectId ?? nextBlock.projectId,
        options?.clientId ?? nextBlock.clientId,
      );

      if (!ruleSaved) {
        toast.success('Activity updated');
      }

      onUpdated(nextBlock);
      setOpen(false);
    });
  }

  if (!canEdit || block.isExcluded) {
    return <ActivityAssignmentDisplay block={block} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group max-w-full min-w-0 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[var(--workspace-control-surface)]/60',
            triggerClassName,
          )}
          disabled={pending}
        >
          <ActivityAssignmentDisplay block={block} interactive />
        </button>
      </PopoverTrigger>
      <PopoverContent align={popoverAlign} className="w-80 space-y-3 p-3">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Assign block
        </p>
        <div className="space-y-2">
          <Select
            value={clientId}
            onValueChange={setClientId}
            disabled={pending}
          >
            <SelectTrigger className="h-8 bg-[var(--workspace-control-surface)] text-xs">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((client) => (
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
            <SelectTrigger className="h-8 bg-[var(--workspace-control-surface)] text-xs">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((project) => (
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
            <SelectTrigger className="h-8 bg-[var(--workspace-control-surface)] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="billable">Billable</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ActivityRememberRuleSelector
          options={ruleOptions}
          selectedKey={selectedRuleKey}
          onSelectedKeyChange={setSelectedRuleKey}
          rememberRule={rememberRule}
          onRememberRuleChange={setRememberRule}
          disabled={pending}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="ozer-gradient-btn flex-1"
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  updateActivityBlockAction({
                    accountId,
                    accountSlug,
                    blockId: block.id,
                    projectId: projectId === 'none' ? null : projectId,
                    clientId: clientId === 'none' ? null : clientId,
                    isConfirmed: true,
                    workClassification,
                  }),
                {
                  ...block,
                  projectId: projectId === 'none' ? null : projectId,
                  clientId: clientId === 'none' ? null : clientId,
                  projectName:
                    projects.find((project) => project.id === projectId)
                      ?.name ?? null,
                  clientName:
                    clients.find((client) => client.id === clientId)?.name ??
                    null,
                  isConfirmed: true,
                  workClassification,
                },
                {
                  projectId: projectId === 'none' ? null : projectId,
                  clientId: clientId === 'none' ? null : clientId,
                },
              )
            }
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Confirm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              runAction(
                () =>
                  excludeActivityBlockAction({
                    accountId,
                    accountSlug,
                    blockId: block.id,
                  }),
                { ...block, isExcluded: true },
              )
            }
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
