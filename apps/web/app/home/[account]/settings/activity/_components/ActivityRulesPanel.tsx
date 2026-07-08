'use client';

import { useState, useTransition } from 'react';

import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import {
  createManualActivityRuleAction,
  deleteActivityRuleAction,
  type ActivityRuleRow,
} from '~/home/[account]/activity/_lib/server/activity-rules-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  initialRules: ActivityRuleRow[];
  projects: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
};

export function ActivityRulesPanel({
  accountId,
  accountSlug,
  initialRules,
  projects,
  clients,
}: Props) {
  const [rules, setRules] = useState(initialRules);
  const [pending, startTransition] = useTransition();
  const [matchType, setMatchType] =
    useState<'domain' | 'app_name' | 'title_contains'>('domain');
  const [matchValue, setMatchValue] = useState('');
  const [clientId, setClientId] = useState('none');
  const [projectId, setProjectId] = useState('none');

  function handleCreate() {
    startTransition(async () => {
      const result = await createManualActivityRuleAction({
        accountId,
        accountSlug,
        matchType,
        matchValue,
        clientId: clientId === 'none' ? null : clientId,
        projectId: projectId === 'none' ? null : projectId,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Could not create rule');
        return;
      }

      toast.success('Rule saved');
      setMatchValue('');
      window.location.reload();
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      const result = await deleteActivityRuleAction({
        accountId,
        accountSlug,
        ruleId,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Could not delete rule');
        return;
      }

      setRules((current) => current.filter((rule) => rule.id !== ruleId));
      toast.success('Rule removed');
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Assignment rules
        </h3>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Auto-assign future sessions when app, domain, or window title matches.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          value={matchType}
          onValueChange={(value) =>
            setMatchType(value as 'domain' | 'app_name' | 'title_contains')
          }
        >
          <SelectTrigger className="h-9 bg-[var(--workspace-control-surface)] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="domain">Domain</SelectItem>
            <SelectItem value="app_name">App name</SelectItem>
            <SelectItem value="title_contains">Title contains</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={matchValue}
          onChange={(e) => setMatchValue(e.target.value)}
          placeholder={
            matchType === 'domain'
              ? 'e.g. figma.com'
              : matchType === 'app_name'
                ? 'e.g. Cursor'
                : 'e.g. Client project name'
          }
          className="h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm"
        />
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="h-9 bg-[var(--workspace-control-surface)] text-xs">
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
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 bg-[var(--workspace-control-surface)] text-xs">
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
        <Button
          type="button"
          size="sm"
          className="ozer-gradient-btn h-9"
          disabled={pending || !matchValue.trim()}
          onClick={handleCreate}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add rule'}
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No rules yet. Assign sessions on the activity page with &quot;Remember
          for future&quot;, or add one here.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--workspace-shell-text)]">
                  {rule.matchType === 'title_contains'
                    ? `Title contains "${rule.matchValue}"`
                    : rule.matchType === 'domain'
                      ? rule.matchValue
                      : rule.matchValue}
                </p>
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  → {rule.clientName ?? 'No client'}
                  {rule.projectName ? ` · ${rule.projectName}` : ''}
                  {rule.createdFrom === 'learned' ? ' · learned' : ''}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                disabled={pending}
                onClick={() => handleDelete(rule.id)}
                aria-label="Delete rule"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
