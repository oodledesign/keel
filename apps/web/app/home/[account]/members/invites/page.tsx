import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ArrowLeft, PlusCircle } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import {
  AccountInvitationsTable,
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

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { loadInvitesPageData } from '../_lib/server/members-page.loader';
import { SeatUsageSummary } from '../_components/seat-usage-summary';
import { loadSeatUsageSummary } from '../_lib/server/seat-usage.loader';

interface TeamAccountInvitesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:invites.pageTitle');

  return {
    title,
  };
};

async function TeamAccountInvitesPage({ params }: TeamAccountInvitesPageProps) {
  const client = getSupabaseServerClient();
  const slug = (await params).account;
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

  const [invitations, canAddMember, { account }] = await loadInvitesPageData(
    client,
    slug,
  );

  const [{ data: inviteProjects }, seatUsage] = await Promise.all([
    client
      .from('projects')
      .select('id, name')
      .eq('account_id', account.id)
      .order('name')
      .limit(200),
    loadSeatUsageSummary(
      client,
      account.id,
      account.slug,
      workspace.workspaceProfile,
    ),
  ]);

  const canManageRoles =
    account.permissions?.includes('roles.manage') || access.canManageRoles;
  const canManageInvitations =
    account.permissions?.includes('invites.manage') || access.canManageInvites;
  const currentUserRoleHierarchy = account.role_hierarchy_level;
  const membersHref = pathsConfig.app.accountMembers.replace(
    '[account]',
    account.slug,
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey={'teams:pendingInvitesHeading'} />}
        description={<AppBreadcrumbs />}
        account={account.slug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="flex w-full max-w-6xl flex-col space-y-4 pb-32">
          <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col space-y-1.5">
                <CardTitle>
                  <Trans i18nKey={'teams:pendingInvitesHeading'} />
                </CardTitle>

                <CardDescription>
                  <Trans i18nKey={'teams:pendingInvitesDescription'} />
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-[color:var(--workspace-shell-border)]"
                >
                  <Link href={membersHref}>
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    <Trans
                      i18nKey="teams:backToMembers"
                      defaults="Back to team"
                    />
                  </Link>
                </Button>

                <If condition={canManageInvitations && canAddMember}>
                  <InviteMembersDialogContainer
                    userRoleHierarchy={currentUserRoleHierarchy}
                    accountSlug={account.slug}
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

            <CardContent className="space-y-4">
              <SeatUsageSummary {...seatUsage} />
              <AccountInvitationsTable
                permissions={{
                  canUpdateInvitation: canManageRoles,
                  canRemoveInvitation: canManageRoles,
                  currentUserRoleHierarchy,
                }}
                invitations={invitations}
              />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountInvitesPage);
