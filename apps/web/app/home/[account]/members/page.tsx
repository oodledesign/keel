import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ArrowRight, PlusCircle } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import {
  AccountMembersTable,
  InviteMembersDialogContainer,
} from '@kit/team-accounts/components';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { If } from '@kit/ui/if';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { loadMembersPageData } from './_lib/server/members-page.loader';

interface TeamAccountMembersPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ create?: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:members.pageTitle');

  return {
    title,
  };
};

async function TeamAccountMembersPage({
  params,
  searchParams,
}: TeamAccountMembersPageProps) {
  const client = getSupabaseServerClient();
  const slug = (await params).account;
  const openInvite = (await searchParams).create === 'invite';
  const workspace = await loadTeamWorkspace(slug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewMembers ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'team')
  ) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const [members, invitations, canAddMember, { user, account }] =
    await loadMembersPageData(client, slug);

  const { data: inviteProjects } = await client
    .from('projects')
    .select('id, name')
    .eq('account_id', account.id)
    .order('name')
    .limit(200);

  const canManageRoles =
    account.permissions?.includes('roles.manage') || access.canManageRoles;
  const canManageInvitations =
    account.permissions?.includes('invites.manage') || access.canManageInvites;

  const isPrimaryOwner = account.primary_owner_user_id === user.id;
  const currentUserRoleHierarchy = account.role_hierarchy_level;
  const pendingInvitesHref = pathsConfig.app.accountMembersInvites.replace(
    '[account]',
    account.slug,
  );
  const pendingCount = invitations.length;

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey={'common:routes.members'} />}
        description={<AppBreadcrumbs />}
        account={account.slug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="flex w-full max-w-6xl flex-col space-y-4 pb-32">
          <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col space-y-1.5">
                <CardTitle>
                  <Trans i18nKey={'common:accountMembers'} />
                </CardTitle>

                <CardDescription>
                  <Trans i18nKey={'common:membersTabDescription'} />
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-[color:var(--workspace-shell-border)]"
                >
                  <Link href={pendingInvitesHref}>
                    <Trans
                      i18nKey="teams:viewPendingInvites"
                      values={{ count: pendingCount }}
                      defaults="Pending invites ({{count}})"
                    />
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>

                <If condition={canManageInvitations && canAddMember}>
                  <InviteMembersDialogContainer
                    userRoleHierarchy={currentUserRoleHierarchy}
                    accountSlug={account.slug}
                    defaultOpen={openInvite}
                    showSeatKind={
                      workspace.workspaceProfile === 'commercial_property'
                    }
                    projects={(inviteProjects ?? []).map((project) => ({
                      id: project.id,
                      name: project.name?.trim() || 'Untitled project',
                    }))}
                  >
                    <Button size="sm" data-test="invite-members-form-trigger">
                      <PlusCircle className="mr-2 w-4" />

                      <span>
                        <Trans i18nKey={'teams:inviteMembersButton'} />
                      </span>
                    </Button>
                  </InviteMembersDialogContainer>
                </If>
              </div>
            </CardHeader>

            <CardContent>
              <AccountMembersTable
                userRoleHierarchy={currentUserRoleHierarchy}
                currentUserId={user.id}
                currentAccountId={account.id}
                members={members}
                isPrimaryOwner={isPrimaryOwner}
                canManageRoles={canManageRoles}
              />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountMembersPage);
