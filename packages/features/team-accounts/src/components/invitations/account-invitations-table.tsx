'use client';

import { useState } from 'react';

import { Ellipsis } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Database } from '@kit/supabase/database';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { RoleBadge } from '../members/role-badge';
import { DeleteInvitationDialog } from './delete-invitation-dialog';
import { RenewInvitationDialog } from './renew-invitation-dialog';
import { UpdateInvitationDialog } from './update-invitation-dialog';

type Invitations =
  Database['public']['Functions']['get_account_invitations']['Returns'];

type AccountInvitationsTableProps = {
  invitations: Invitations;

  permissions: {
    canUpdateInvitation: boolean;
    canRemoveInvitation: boolean;
    currentUserRoleHierarchy: number;
  };
};

export function AccountInvitationsTable({
  invitations,
  permissions,
}: AccountInvitationsTableProps) {
  const { t } = useTranslation('teams');
  const [search, setSearch] = useState('');

  const filteredInvitations = invitations.filter((member) => {
    const searchString = search.toLowerCase();
    const email = member.email.toLowerCase();

    return (
      email.includes(searchString) ||
      member.role.toLowerCase().includes(searchString)
    );
  });

  return (
    <div className="flex flex-col space-y-4">
      <Input
        value={search}
        onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        placeholder={t(`searchInvitations`)}
        className="max-w-sm border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
      />

      {filteredInvitations.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          <Trans i18nKey="teams:noPendingInvites" />
        </p>
      ) : (
        <div
          data-cy="invitations-table"
          data-test="invitations-card-grid"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filteredInvitations.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              permissions={permissions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvitationCard({
  invitation,
  permissions,
}: {
  invitation: Invitations[0];
  permissions: AccountInvitationsTableProps['permissions'];
}) {
  const { t } = useTranslation('teams');
  const isExpired = getIsInviteExpired(invitation.expires_at);
  const invitedLabel = new Date(invitation.created_at).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
  const expiresLabel = new Date(invitation.expires_at).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );

  return (
    <div
      data-test="invitation-card"
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-5',
        'transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
      )}
    >
      <div className="flex items-start gap-3">
        <ProfileAvatar text={invitation.email} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                data-test="invitation-email"
                className="truncate text-base font-semibold text-[var(--workspace-shell-text)]"
              >
                {invitation.email}
              </p>
              <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                {t('invitedAtLabel')}: {invitedLabel}
              </p>
            </div>
            <ActionsDropdown
              permissions={permissions}
              invitation={invitation}
            />
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <RoleBadge role={invitation.role} />
        {isExpired ? (
          <Badge variant="warning">{t('expired')}</Badge>
        ) : (
          <Badge variant="success">{t('active')}</Badge>
        )}
        <span className="ml-auto text-xs text-[var(--workspace-shell-text)]/45">
          {t('expiresAtLabel')}: {expiresLabel}
        </span>
      </div>
    </div>
  );
}

function ActionsDropdown({
  permissions,
  invitation,
}: {
  permissions: AccountInvitationsTableProps['permissions'];
  invitation: Invitations[0];
}) {
  const [isDeletingInvite, setIsDeletingInvite] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isRenewingInvite, setIsRenewingInvite] = useState(false);

  if (!permissions.canUpdateInvitation && !permissions.canRemoveInvitation) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          >
            <Ellipsis className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <If condition={permissions.canUpdateInvitation}>
            <DropdownMenuItem
              data-test="update-invitation-trigger"
              onClick={() => setIsUpdatingRole(true)}
            >
              <Trans i18nKey={'teams:updateInvitation'} />
            </DropdownMenuItem>

            <If condition={getIsInviteExpired(invitation.expires_at)}>
              <DropdownMenuItem
                data-test="renew-invitation-trigger"
                onClick={() => setIsRenewingInvite(true)}
              >
                <Trans i18nKey={'teams:renewInvitation'} />
              </DropdownMenuItem>
            </If>
          </If>

          <If condition={permissions.canRemoveInvitation}>
            <DropdownMenuItem
              data-test="remove-invitation-trigger"
              onClick={() => setIsDeletingInvite(true)}
            >
              <Trans i18nKey={'teams:removeInvitation'} />
            </DropdownMenuItem>
          </If>
        </DropdownMenuContent>
      </DropdownMenu>

      <If condition={isDeletingInvite}>
        <DeleteInvitationDialog
          isOpen
          setIsOpen={setIsDeletingInvite}
          invitationId={invitation.id}
        />
      </If>

      <If condition={isUpdatingRole}>
        <UpdateInvitationDialog
          isOpen
          setIsOpen={setIsUpdatingRole}
          invitationId={invitation.id}
          userRole={invitation.role}
          userRoleHierarchy={permissions.currentUserRoleHierarchy}
        />
      </If>

      <If condition={isRenewingInvite}>
        <RenewInvitationDialog
          isOpen
          setIsOpen={setIsRenewingInvite}
          invitationId={invitation.id}
          email={invitation.email}
        />
      </If>
    </>
  );
}

function getIsInviteExpired(isoExpiresAt: string) {
  const isoExpiresAtDate = new Date(isoExpiresAt);
  const currentIsoTimeDate = new Date();

  return isoExpiresAtDate < currentIsoTimeDate;
}
