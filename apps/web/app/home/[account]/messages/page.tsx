import { redirect } from 'next/navigation';

import { Trans } from '@kit/ui/trans';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { isWorkNavModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { MessagesPageContent } from './_components/messages-page-content';
import { assertMessagesSchemaAvailable } from './_lib/server/messages-schema';
import { loadMessagesPageData } from './_lib/server/messages-page.loader';

interface MessagesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Messages',
});

async function MessagesPage({ params }: MessagesPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewMessages ||
    !isWorkNavModuleEnabled(workspace.moduleSettings, 'messages')
  ) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const schemaOk = await assertMessagesSchemaAvailable();
  if (!schemaOk) {
    return (
      <>
        <TeamAccountLayoutPageHeader
          title={<Trans i18nKey="common:routes.messages" defaults="Messages" />}
          description="Team and client messaging"
          account={accountSlug}
        />
        <div className="px-4 py-8 text-sm text-zinc-400">
          Messaging tables are not available yet. Apply the latest Supabase
          migrations (including{' '}
          <code className="text-xs">20260627120000_messages_module.sql</code>).
        </div>
      </>
    );
  }

  const data = await loadMessagesPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={<Trans i18nKey="common:routes.messages" defaults="Messages" />}
        description="Direct, group, and job-linked conversations with your team and clients"
        account={accountSlug}
      />

      <div className="flex flex-1 flex-col bg-[var(--workspace-shell-canvas)] px-2 pb-4 pt-2 md:px-4 md:pb-6 md:pt-4">
        <MessagesPageContent
          accountId={data.accountId}
          accountSlug={data.accountSlug}
          userId={data.userId}
          canMessageClients={data.canMessageClients}
          initialThreads={data.threads}
          memberOptions={data.memberOptions}
          clientOptions={data.clientOptions}
          jobOptions={data.jobOptions}
        />
      </div>
    </>
  );
}

export default withI18n(MessagesPage);
