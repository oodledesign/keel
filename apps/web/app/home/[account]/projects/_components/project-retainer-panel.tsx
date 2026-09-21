'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { RetainerServiceListEditor } from '~/components/retainers/retainer-service-list-editor';
import { ClientSubscriptionStatusList } from '~/home/[account]/_components/client-subscription-status-list';
import { AttachRetainerPlanButton } from '~/home/[account]/clients/_components/attach-retainer-plan-button';
import type {
  CatalogueService,
  EffectiveService,
  EffectiveServiceList,
  ServiceCategory,
} from '~/lib/retainers/effective-services';
import { inheritanceLabel } from '~/lib/retainers/effective-services';
import type {
  ProjectRetainerBurn,
  ProjectRetainerRecord,
  RetainerServiceRecord,
} from '~/lib/retainers/types';

import {
  addCustomProjectRetainerServiceAction,
  adjustProjectRetainerBalanceAction,
  loadProjectRetainerAction,
  replaceProjectRetainerServicesAction,
  resetProjectRetainerServicesAction,
  updateProjectRetainerSettingsAction,
} from '../_lib/server/project-retainer-actions';

type Loaded = {
  retainer: ProjectRetainerRecord;
  catalogue: RetainerServiceRecord[];
  recent: ProjectRetainerBurn[];
  effective: EffectiveServiceList;
  library: CatalogueService[];
  categories: ServiceCategory[];
};

export function ProjectRetainerPanel({
  accountId,
  projectId,
  clientId,
  canEdit,
}: {
  accountId: string;
  projectId: string;
  clientId?: string | null;
  canEdit: boolean;
}) {
  const [retainer, setRetainer] = useState<ProjectRetainerRecord | null>(null);
  const [effective, setEffective] = useState<EffectiveServiceList | null>(null);
  const [library, setLibrary] = useState<CatalogueService[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [recent, setRecent] = useState<ProjectRetainerBurn[]>([]);
  const [adjustBy, setAdjustBy] = useState('10');
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  function applyLoaded(data: Loaded) {
    setRetainer(data.retainer);
    setEffective(data.effective);
    setLibrary(data.library);
    setCategories(data.categories);
    setRecent(data.recent);
  }

  useEffect(() => {
    let cancelled = false;
    loadProjectRetainerAction({ accountId, projectId, clientId })
      .then((data) => {
        if (cancelled) return;
        setRetainer(data.retainer);
        setEffective(data.effective);
        setLibrary(data.library);
        setCategories(data.categories);
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
  }, [accountId, projectId, clientId]);

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

  function replaceServices(services: EffectiveService[]) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const data = await replaceProjectRetainerServicesAction({
          accountId,
          projectId,
          clientId,
          services: services.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            creditCost: row.creditCost,
            requestTypeId: row.requestTypeId,
            isActive: row.isActive,
            isVisible: row.isVisible,
            sortOrder: row.sortOrder,
          })),
        });
        applyLoaded(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update services',
        );
      }
    });
  }

  function resetServices() {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const data = await resetProjectRetainerServicesAction({
          accountId,
          projectId,
          clientId,
        });
        applyLoaded(data);
        toast.success('Reset to inherited services');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not reset services',
        );
      }
    });
  }

  function addCustom(input: {
    name: string;
    description: string | null;
    creditCost: number;
    categoryId?: string | null;
    isVisible?: boolean;
  }) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const data = await addCustomProjectRetainerServiceAction({
          accountId,
          projectId,
          clientId,
          ...input,
        });
        applyLoaded(data);
        toast.success('Custom service added');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add service',
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

  if (!retainer || !effective) return null;

  const step = Number(adjustBy);
  const resetLabel =
    effective.inheritedFrom === 'client' || !clientId
      ? 'Reset to client / workspace'
      : 'Reset to client defaults';

  return (
    <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Retainer
          </h3>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Attach a plan, manage services, and track credits on this project.
            Matching never emails the client.
          </p>
        </div>
        {clientId ? (
          <AttachRetainerPlanButton
            accountId={accountId}
            clientId={clientId}
            projectId={projectId}
            canEdit={canEdit}
          />
        ) : null}
      </div>

      {!clientId ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Link a client to this project before attaching a retainer plan.
        </p>
      ) : (
        <ClientSubscriptionStatusList
          accountId={accountId}
          clientId={clientId}
          projectId={projectId}
          canEdit={canEdit}
          emptyLabel="No plan on this project yet. Add a retainer to collect payment."
        />
      )}

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

      <RetainerServiceListEditor
        services={effective.services}
        library={library}
        categories={categories}
        inheritanceLabel={inheritanceLabel(effective)}
        resetLabel={resetLabel}
        customized={effective.customized}
        canEdit={canEdit}
        pending={pending}
        emptyHint="No services on this project yet. Inherit the client or workspace list, or add custom ones."
        onReplace={replaceServices}
        onReset={resetServices}
        onAddCustom={addCustom}
      />

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
