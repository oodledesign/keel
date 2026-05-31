'use client';

import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { WorkspaceProfile } from '../../_lib/workspace-profile';
import { restoreWorkspaceModules } from '../../_lib/server/account-module-settings.actions';

type Props = {
  accountId: string;
  accountSlug: string;
  workspaceProfile: WorkspaceProfile;
};

export function RestoreWorkspaceModulesCard({
  accountId,
  accountSlug,
  workspaceProfile,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      try {
        const result = await restoreWorkspaceModules({
          accountId,
          accountSlug,
          workspaceProfile,
        });
        toast.success(`Navigation restored (${result.restored} modules)`);
        window.location.reload();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not restore navigation',
        );
      }
    });
  }

  return (
    <div className="mx-auto mb-6 flex max-w-2xl flex-col gap-3 rounded-2xl border border-amber-400/25 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
      <div>
        <h2 className="text-base font-semibold text-amber-100">
          Missing sidebar links?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          If you only see Settings in the sidebar, workspace modules were turned
          off in the database. Restoring defaults turns all modules back on. Your
          tasks, projects, and clients are not deleted.
        </p>
      </div>
      <Button
        type="button"
        disabled={isPending}
        className={workspaceBtnPrimaryMd}
        onClick={handleRestore}
      >
        {isPending ? 'Restoring…' : 'Restore navigation modules'}
      </Button>
    </div>
  );
}
