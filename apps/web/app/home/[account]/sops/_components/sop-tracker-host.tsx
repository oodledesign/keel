import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadActiveAssistRunForUser } from '../_lib/server/sops-data';
import { SopTrackerWidget } from './sop-tracker-widget';

type SopTrackerHostProps = {
  accountId: string;
  accountSlug: string;
};

export async function SopTrackerHost({
  accountId,
  accountSlug,
}: SopTrackerHostProps) {
  const user = await requireUserInServerComponent();
  const active = await loadActiveAssistRunForUser({
    accountId,
    userId: user.id,
  });

  if (!active) return null;

  return (
    <SopTrackerWidget
      accountId={accountId}
      accountSlug={accountSlug}
      run={{
        ...active.run,
        assist_mode: active.run.assist_mode ?? true,
      }}
      steps={active.steps}
      playbookSteps={active.playbookSteps}
    />
  );
}
