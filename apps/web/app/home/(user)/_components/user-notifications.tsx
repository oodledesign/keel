import { WorkspaceNotificationsPopover } from '~/components/workspace-shell/workspace-notifications-popover';
import featuresFlagConfig from '~/config/feature-flags.config';

export function UserNotifications(props: { userId: string }) {
  if (!featuresFlagConfig.enableNotifications) {
    return null;
  }

  return (
    <WorkspaceNotificationsPopover
      accountIds={[props.userId]}
      userId={props.userId}
      realtime={featuresFlagConfig.realtimeNotifications}
    />
  );
}
