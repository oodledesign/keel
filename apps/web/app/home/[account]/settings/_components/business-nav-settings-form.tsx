'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { BusinessNavPicker } from '../../_components/business-nav-picker';
import { BUSINESS_NAV_CHOICE_KEYS } from '../../_lib/business-nav-preferences';
import { saveBusinessNavAction } from '../_lib/server/business-nav-actions';

export function BusinessNavSettingsForm({
  accountId,
  initialVisible,
  paidOnlyKeys,
  canEdit,
}: {
  accountId: string;
  initialVisible: Record<string, boolean>;
  paidOnlyKeys: readonly string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initialVisible);

  const visibleCount = useMemo(
    () => BUSINESS_NAV_CHOICE_KEYS.filter((key) => values[key] ?? true).length,
    [values],
  );

  const save = () => {
    startTransition(async () => {
      try {
        await saveBusinessNavAction({ accountId, visible: values });
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
          Choose which links appear in the sidebar for everyone in this
          workspace. Hiding a link doesn&apos;t turn the feature off.
        </p>
      </div>

      <BusinessNavPicker
        values={values}
        disabled={!canEdit || pending}
        paidOnlyKeys={paidOnlyKeys}
        onChange={(key, visible) =>
          setValues((current) => ({ ...current, [key]: visible }))
        }
      />

      {canEdit ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Dashboard plus {visibleCount} of {BUSINESS_NAV_CHOICE_KEYS.length}{' '}
            links visible
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
