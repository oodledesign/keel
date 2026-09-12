'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import type {
  ProjectRetainerBurn,
  ProjectRetainerRecord,
  RetainerServiceRecord,
} from '~/lib/retainers/types';

import {
  adjustProjectRetainerBalanceAction,
  loadProjectRetainerAction,
  updateProjectRetainerSettingsAction,
} from '../_lib/server/project-retainer-actions';

export function ProjectRetainerPanel({
  accountId,
  projectId,
  canEdit,
}: {
  accountId: string;
  projectId: string;
  canEdit: boolean;
}) {
  const [retainer, setRetainer] = useState<ProjectRetainerRecord | null>(null);
  const [catalogue, setCatalogue] = useState<RetainerServiceRecord[]>([]);
  const [recent, setRecent] = useState<ProjectRetainerBurn[]>([]);
  const [adjustBy, setAdjustBy] = useState('10');
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadProjectRetainerAction({ accountId, projectId })
      .then((data) => {
        if (cancelled) return;
        setRetainer(data.retainer);
        setCatalogue(data.catalogue);
        setRecent(data.recent);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not load project retainer',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, projectId]);

  function applyLoaded(data: {
    retainer: ProjectRetainerRecord;
    catalogue: RetainerServiceRecord[];
    recent: ProjectRetainerBurn[];
  }) {
    setRetainer(data.retainer);
    setCatalogue(data.catalogue);
    setRecent(data.recent);
  }

  function toggleSetting(
    patch: Partial<
      Pick<ProjectRetainerRecord, 'autoMatchEnabled' | 'weeklyDigestEnabled'>
    >,
  ) {
    if (!retainer || !canEdit) return;
    startTransition(async () => {
      try {
        const data = await updateProjectRetainerSettingsAction({
          accountId,
          projectId,
          autoMatchEnabled: patch.autoMatchEnabled,
          weeklyDigestEnabled: patch.weeklyDigestEnabled,
        });
        applyLoaded(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update settings',
        );
      }
    });
  }

  function toggleService(serviceId: string, enabled: boolean) {
    if (!retainer || !canEdit) return;
    const next = enabled
      ? [...new Set([...retainer.allowedServiceIds, serviceId])]
      : retainer.allowedServiceIds.filter((id) => id !== serviceId);
    startTransition(async () => {
      try {
        const data = await updateProjectRetainerSettingsAction({
          accountId,
          projectId,
          allowedServiceIds: next,
        });
        applyLoaded(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update services',
        );
      }
    });
  }

  function adjust(delta: number) {
    if (!canEdit || delta === 0) return;
    startTransition(async () => {
      try {
        const data = await adjustProjectRetainerBalanceAction({
          accountId,
          projectId,
          delta,
        });
        applyLoaded(data);
        toast.success(delta > 0 ? 'Credits added' : 'Credits removed');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update balance',
        );
      }
    });
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/60 p-4">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading retainer…
        </p>
      </div>
    );
  }

  if (!retainer) return null;

  const activeCatalogue = catalogue.filter((row) => row.isActive);
  const step = Number(adjustBy);

  return (
    <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/60 p-4">
      <div>
        <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Project retainer
        </h3>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Credits live on this project. Matching never emails the client.
        </p>
      </div>

      <p className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
        {retainer.creditBalance}
        <span className="ml-1 text-sm font-normal text-[var(--workspace-shell-text-muted)]">
          credits
        </span>
      </p>

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Adjust by</Label>
            <Input
              type="number"
              min={1}
              className="h-8 w-24"
              value={adjustBy}
              onChange={(event) => setAdjustBy(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending || !Number.isFinite(step) || step < 1}
            onClick={() => adjust(Math.round(step))}
          >
            {pending ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !Number.isFinite(step) || step < 1}
            onClick={() => adjust(-Math.round(step))}
          >
            Remove
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--workspace-shell-text)]">
              Auto-match
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Apply only for high-confidence existing project services.
            </p>
          </div>
          <Switch
            checked={retainer.autoMatchEnabled}
            disabled={!canEdit || pending}
            onCheckedChange={(checked) =>
              toggleSetting({ autoMatchEnabled: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--workspace-shell-text)]">
              Weekly digest
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              End of week, Europe/London, only if credits moved.
            </p>
          </div>
          <Switch
            checked={retainer.weeklyDigestEnabled}
            disabled={!canEdit || pending}
            onCheckedChange={(checked) =>
              toggleSetting({ weeklyDigestEnabled: checked })
            }
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
          Allowed services
        </p>
        {activeCatalogue.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Add services in workspace Settings → Services.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeCatalogue.map((service) => {
              const allowed = retainer.allowedServiceIds.includes(service.id);
              return (
                <li
                  key={service.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate text-[var(--workspace-shell-text)]">
                    {service.name}
                    <span className="ml-1 text-xs text-[var(--workspace-shell-text-muted)]">
                      {service.creditCost}c
                    </span>
                  </span>
                  <Switch
                    checked={allowed}
                    disabled={!canEdit || pending}
                    onCheckedChange={(checked) =>
                      toggleService(service.id, checked)
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
          Empty allowlist matches previously used services first, then the
          workspace catalogue.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
          Recent activity
        </p>
        {recent.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            No burns or adjustments yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((row) => (
              <li
                key={row.id}
                className="text-xs text-[var(--workspace-shell-text-muted)]"
              >
                <span className="text-[var(--workspace-shell-text)]">
                  {row.amount > 0 ? '+' : ''}
                  {row.amount}
                </span>{' '}
                {row.type}
                {row.serviceName ? ` · ${row.serviceName}` : ''}
                {row.taskTitle ? ` · ${row.taskTitle}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
