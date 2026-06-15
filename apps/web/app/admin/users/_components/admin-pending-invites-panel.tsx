'use client';

import { useTransition } from 'react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import {
  resendAdminUserInviteAction,
  revokeAdminUserInviteAction,
} from '~/lib/admin/user-invites.actions';
import type { AdminUserInviteRow } from '~/lib/admin/user-invites.schema';
import { parseAdminUserInviteAccessConfig, summarizeAccessConfig } from '~/lib/admin/user-invites.schema';

export function AdminPendingInvitesPanel(props: {
  invites: AdminUserInviteRow[];
}) {
  if (props.invites.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pending invitations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.invites.map((invite) => (
          <PendingInviteRow key={invite.id} invite={invite} />
        ))}
      </CardContent>
    </Card>
  );
}

function PendingInviteRow(props: { invite: AdminUserInviteRow }) {
  const [pending, startTransition] = useTransition();
  const config = parseAdminUserInviteAccessConfig(props.invite.access_config);
  const summary = summarizeAccessConfig(config);
  const expires = new Date(props.invite.expires_at).toLocaleDateString();

  const run = (action: () => Promise<{ success: boolean }>, success: string) => {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Action failed');
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{props.invite.email}</span>
          <Badge variant="outline">Pending</Badge>
        </div>
        <p className="text-muted-foreground text-sm">{summary}</p>
        <p className="text-muted-foreground text-xs">Expires {expires}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              () => resendAdminUserInviteAction({ inviteId: props.invite.id }),
              'Invitation resent',
            )
          }
        >
          Resend
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(
              () => revokeAdminUserInviteAction({ inviteId: props.invite.id }),
              'Invitation revoked',
            )
          }
        >
          Revoke
        </Button>
      </div>
    </div>
  );
}
