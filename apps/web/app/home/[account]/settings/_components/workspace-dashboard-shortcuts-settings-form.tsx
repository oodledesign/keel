'use client';

import { useState, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';

import { Button } from '@kit/ui/button';

import { DashboardShortcutsEditor } from '~/components/dashboard-shortcuts/dashboard-shortcuts-editor';
import { saveWorkspaceDashboardShortcutsAction } from '~/lib/dashboard-shortcuts/dashboard-shortcuts.actions';
import type { StoredShortcut } from '~/lib/dashboard-shortcuts/types';

type Props = {
  accountId: string;
  accountSlug: string;
  initialShortcuts: StoredShortcut[];
  initialMobileNavShortcuts: StoredShortcut[];
};

export function WorkspaceDashboardShortcutsSettingsForm({
  accountId,
  accountSlug,
  initialShortcuts,
  initialMobileNavShortcuts,
}: Props) {
  const [shortcuts, setShortcuts] = useState(initialShortcuts);
  const [mobileNavShortcuts, setMobileNavShortcuts] = useState(
    initialMobileNavShortcuts,
  );
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await saveWorkspaceDashboardShortcutsAction({
        accountId,
        accountSlug,
        shortcuts,
        mobileNavShortcuts,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Could not save shortcuts');
        return;
      }
      toast.success('Workspace shortcuts saved');
    });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Dashboard shortcuts
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Quick links at the top of this workspace&apos;s dashboard — only pages
            within this workspace.
          </p>
        </div>
        <DashboardShortcutsEditor
          scope="workspace"
          accountSlug={accountSlug}
          shortcuts={shortcuts}
          onChange={setShortcuts}
        />
      </section>

      <section className="space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-8">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Mobile bottom navigation
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Choose up to three icon shortcuts beside Home and Menu on your phone
            for this workspace.
          </p>
        </div>
        <DashboardShortcutsEditor
          scope="workspace"
          accountSlug={accountSlug}
          shortcuts={mobileNavShortcuts}
          onChange={setMobileNavShortcuts}
          maxShortcuts={3}
          helperText="Pick up to 3 pages for the floating bar on mobile."
          emptyText="No mobile shortcuts — only Home and Menu will show."
        />
      </section>

      <Button
        className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
        disabled={pending}
        onClick={save}
      >
        {pending ? 'Saving…' : 'Save workspace preferences'}
      </Button>
    </div>
  );
}
