'use client';

import { useMemo, useState } from 'react';

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

import { RemoveMemberDialog } from './remove-member-dialog';
import { RoleBadge } from './role-badge';
import { TransferOwnershipDialog } from './transfer-ownership-dialog';
import { UpdateMemberRoleDialog } from './update-member-role-dialog';

type Members =
  Database['public']['Functions']['get_account_members']['Returns'];

interface Permissions {
  canUpdateRole: (roleHierarchy: number) => boolean;
  canRemoveFromAccount: (roleHierarchy: number) => boolean;
  canTransferOwnership: boolean;
}

type AccountMembersTableProps = {
  members: Members;
  currentUserId: string;
  currentAccountId: string;
  userRoleHierarchy: number;
  isPrimaryOwner: boolean;
  /** members.manage — admins can update/remove lower-hierarchy members */
  canManageMembers: boolean;
  /** Commercial Property: userId → seat kind */
  seatKindByUserId?: Record<string, 'billable' | 'support'>;
  showSeatKind?: boolean;
};

export function AccountMembersTable({
  members,
  currentUserId,
  currentAccountId,
  isPrimaryOwner,
  userRoleHierarchy,
  canManageMembers,
  seatKindByUserId,
  showSeatKind = false,
}: AccountMembersTableProps) {
  const [search, setSearch] = useState('');
  const { t } = useTranslation('teams');

  const permissions = useMemo(
    () => ({
      canUpdateRole: (targetRole: number) => {
        return (
          isPrimaryOwner ||
          (canManageMembers && userRoleHierarchy < targetRole)
        );
      },
      canRemoveFromAccount: (targetRole: number) => {
        return (
          isPrimaryOwner ||
          (canManageMembers && userRoleHierarchy < targetRole)
        );
      },
      canTransferOwnership: isPrimaryOwner,
    }),
    [isPrimaryOwner, canManageMembers, userRoleHierarchy],
  );

  const filteredMembers = members
    .filter((member) => {
      const searchString = search.toLowerCase();

      const displayName = (
        member.name ??
        member.email.split('@')[0] ??
        ''
      ).toLowerCase();

      return (
        displayName.includes(searchString) ||
        member.email.toLowerCase().includes(searchString) ||
        member.role.toLowerCase().includes(searchString)
      );
    })
    .sort((prev, next) => {
      if (prev.primary_owner_user_id === prev.user_id) {
        return -1;
      }

      if (next.primary_owner_user_id === next.user_id) {
        return 1;
      }

      if (prev.role_hierarchy_level < next.role_hierarchy_level) {
        return -1;
      }

      return 1;
    });

  return (
    <div className="flex flex-col space-y-4">
      <Input
        value={search}
        onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        placeholder={t(`searchMembersPlaceholder`)}
        className="max-w-sm border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
      />

      {filteredMembers.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          <Trans i18nKey="teams:noMembersFound" defaults="No members found" />
        </p>
      ) : (
        <div
          data-test="members-card-grid"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filteredMembers.map((member) => (
            <MemberCard
              key={member.user_id}
              member={member}
              permissions={permissions}
              currentUserId={currentUserId}
              currentAccountId={currentAccountId}
              currentRoleHierarchy={userRoleHierarchy}
              seatKind={seatKindByUserId?.[member.user_id]}
              showSeatKind={showSeatKind}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({
  member,
  permissions,
  currentUserId,
  currentAccountId,
  currentRoleHierarchy,
  seatKind,
  showSeatKind,
}: {
  member: Members[0];
  permissions: Permissions;
  currentUserId: string;
  currentAccountId: string;
  currentRoleHierarchy: number;
  seatKind?: 'billable' | 'support';
  showSeatKind?: boolean;
}) {
  const { t } = useTranslation('teams');
  const displayName = member.name ?? member.email.split('@')[0];
  const isSelf = member.user_id === currentUserId;
  const isPrimaryOwner = member.primary_owner_user_id === member.user_id;
  const joinedLabel = new Date(member.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      data-test="member-card"
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-5',
        'transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
      )}
    >
      <div className="flex items-start gap-3">
        <ProfileAvatar
          displayName={displayName}
          pictureUrl={member.picture_url}
          className="h-12 w-12"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-[var(--workspace-shell-text)]">
                  {displayName}
                </h3>
                <If condition={isSelf}>
                  <Badge variant="outline">{t('youLabel')}</Badge>
                </If>
              </div>
              <p className="mt-0.5 truncate text-sm text-[var(--workspace-shell-text-muted)]">
                {member.email}
              </p>
            </div>
            <ActionsDropdown
              permissions={permissions}
              member={member}
              currentUserId={currentUserId}
              currentTeamAccountId={currentAccountId}
              currentRoleHierarchy={currentRoleHierarchy}
            />
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <RoleBadge role={member.role} />
        <If condition={Boolean(showSeatKind && seatKind)}>
          <Badge variant="outline" className="capitalize">
            {seatKind} seat
          </Badge>
        </If>
        <If condition={isPrimaryOwner}>
          <span className="rounded-md bg-yellow-400/90 px-2.5 py-1 text-xs font-medium text-black">
            {t('primaryOwnerLabel')}
          </span>
        </If>
        <span className="ml-auto text-xs text-[var(--workspace-shell-text)]/45">
          {t('joinedAtLabel')}: {joinedLabel}
        </span>
      </div>
    </div>
  );
}

function ActionsDropdown({
  permissions,
  member,
  currentUserId,
  currentTeamAccountId,
  currentRoleHierarchy,
}: {
  permissions: Permissions;
  member: Members[0];
  currentUserId: string;
  currentTeamAccountId: string;
  currentRoleHierarchy: number;
}) {
  const isCurrentUser = member.user_id === currentUserId;
  const isPrimaryOwner = member.primary_owner_user_id === member.user_id;

  if (isCurrentUser || isPrimaryOwner) {
    return null;
  }

  const memberRoleHierarchy = member.role_hierarchy_level;
  const canUpdateRole = permissions.canUpdateRole(memberRoleHierarchy);

  const canRemoveFromAccount =
    permissions.canRemoveFromAccount(memberRoleHierarchy);

  if (
    !canUpdateRole &&
    !permissions.canTransferOwnership &&
    !canRemoveFromAccount
  ) {
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
          <If condition={canUpdateRole}>
            <UpdateMemberRoleDialog
              userId={member.user_id}
              userRole={member.role}
              teamAccountId={currentTeamAccountId}
              userRoleHierarchy={currentRoleHierarchy}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Trans i18nKey={'teams:updateRole'} />
              </DropdownMenuItem>
            </UpdateMemberRoleDialog>
          </If>

          <If condition={permissions.canTransferOwnership}>
            <TransferOwnershipDialog
              targetDisplayName={member.name ?? member.email}
              accountId={member.account_id}
              userId={member.user_id}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Trans i18nKey={'teams:transferOwnership'} />
              </DropdownMenuItem>
            </TransferOwnershipDialog>
          </If>

          <If condition={canRemoveFromAccount}>
            <RemoveMemberDialog
              teamAccountId={currentTeamAccountId}
              userId={member.user_id}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Trans i18nKey={'teams:removeMember'} />
              </DropdownMenuItem>
            </RemoveMemberDialog>
          </If>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
