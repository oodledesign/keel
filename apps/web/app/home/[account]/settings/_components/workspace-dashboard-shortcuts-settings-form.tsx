'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import { Button } from '@kit/ui/button';

import { DashboardShortcutsEditor } from '~/components/dashboard-shortcuts/dashboard-shortcuts-editor';
import { saveWorkspaceDashboardShortcutsAction } from '~/lib/dashboard-shortcuts/dashboard-shortcuts.actions';
import type { StoredShortcut } from '~/lib/dashboard-shortcuts/types';

type Props = {
  accountId: string;
  accountSlug: string;
  initialShortcuts: StoredShortcut[];
};

export function WorkspaceDashboardShortcutsSettingsForm({
  accountId,
  accountSlug,
  initialShortcuts,
}: Props) {
  const [shortcuts, setShortcuts] = useState(initialShortcuts);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await saveWorkspaceDashboardShortcutsAction({
        accountId,
        accountSlug,
        shortcuts,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Could not save shortcuts');
        return;
      }
      toast.success('Workspace shortcuts saved');
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Quick links at the top of this workspace&apos;s dashboard — only pages
        within this workspace.
      </p>
      <DashboardShortcutsEditor
        scope="workspace"
        accountSlug={accountSlug}
        shortcuts={shortcuts}
        onChange={setShortcuts}
      />
      <Button
        className="bg-[var(--keel-teal)] hover:bg-[#238b7f]"
        disabled={pending}
        onClick={save}
      >
        {pending ? 'Saving…' : 'Save workspace shortcuts'}
      </Button>
    </div>
  );
}
