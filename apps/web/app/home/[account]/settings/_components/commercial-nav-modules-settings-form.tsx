'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  COMMERCIAL_NAV_TOGGLE_KEYS,
  COMMERCIAL_NAV_TOGGLE_LABELS,
  type CommercialNavToggleKey,
} from '../_lib/schema/commercial-nav-modules.schema';
import { saveCommercialNavModules } from '../_lib/server/commercial-nav-modules-actions';

function isNavEnabled(
  settings: Record<string, boolean>,
  key: CommercialNavToggleKey,
) {
  if (!(key in settings)) return key !== 'proposals';
  return settings[key] === true;
}

export function CommercialNavModulesSettingsForm({
  accountId,
  initialSettings,
  canEdit,
}: {
  accountId: string;
  initialSettings: Record<string, boolean>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<CommercialNavToggleKey, boolean>>(
    () =>
      Object.fromEntries(
        COMMERCIAL_NAV_TOGGLE_KEYS.map((key) => [
          key,
          isNavEnabled(initialSettings, key),
        ]),
      ) as Record<CommercialNavToggleKey, boolean>,
  );

  const enabledCount = useMemo(
    () => COMMERCIAL_NAV_TOGGLE_KEYS.filter((key) => values[key]).length,
    [values],
  );

  const save = () => {
    startTransition(async () => {
      try {
        await saveCommercialNavModules({
          accountId,
          modules: values,
        });
        toast.success('Navigation saved');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save navigation',
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
      <div>
        <h2 className="text-base font-semibold">Workspace navigation</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose which links appear in the sidebar. HoTs / Proposals is hidden
          by default.
        </p>
      </div>

      <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
        {COMMERCIAL_NAV_TOGGLE_KEYS.map((key) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                {COMMERCIAL_NAV_TOGGLE_LABELS[key]}
              </p>
              {key === 'proposals' ? (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Optional — most desks keep this off.
                </p>
              ) : null}
            </div>
            <Switch
              checked={values[key]}
              disabled={!canEdit || pending}
              onCheckedChange={(checked) =>
                setValues((current) => ({ ...current, [key]: checked }))
              }
              aria-label={`Show ${COMMERCIAL_NAV_TOGGLE_LABELS[key]}`}
            />
          </li>
        ))}
      </ul>

      {canEdit ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {enabledCount} of {COMMERCIAL_NAV_TOGGLE_KEYS.length} links visible
          </p>
          <Button
            className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            disabled={pending}
            onClick={save}
          >
            {pending ? 'Saving…' : 'Save navigation'}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Only workspace owners and admins can change navigation.
        </p>
      )}
    </div>
  );
}
