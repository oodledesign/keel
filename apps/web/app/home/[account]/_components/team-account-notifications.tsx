import { WorkspaceNotificationsPopover } from '~/components/workspace-shell/workspace-notifications-popover';
import featuresFlagConfig from '~/config/feature-flags.config';

export function TeamAccountNotifications(params: {
  userId: string;
  accountId: string;
}) {
  if (!featuresFlagConfig.enableNotifications) {
    return null;
  }

  return (
    <WorkspaceNotificationsPopover
      accountIds={[params.userId, params.accountId]}
      userId={params.userId}
      realtime={featuresFlagConfig.realtimeNotifications}
    />
  );
}
