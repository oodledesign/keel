import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { redirectIfEmailAssistantNotAllowed } from '~/lib/billing/require-email-assistant-access';
import { loadSuggestedEmailActionItems } from '~/lib/email-assistant/suggested-email-tasks.loader';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { SuggestedEmailTasksClient } from './_components/suggested-email-tasks-client';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  await createI18nServerInstance();
  return {
    title: 'Email tasks to review',
  };
};

async function SuggestedEmailTasksPage({ params }: PageProps) {
  const accountSlug = (await params).account;

  const [, workspace] = await Promise.all([
    redirectIfEmailAssistantNotAllowed(),
    loadTeamWorkspace(accountSlug),
  ]);

  if (!workspace?.account) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const { items, totalCount } = await loadSuggestedEmailActionItems(
    client,
    workspace.user.id,
    { accountId: workspace.account.id, limit: 50 },
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Email tasks to review"
        description="Confirm clear requests from emails that need a reply before they become planner tasks."
        account={accountSlug}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
        <SuggestedEmailTasksClient
          accountSlug={accountSlug}
          accountId={workspace.account.id}
          initialItems={items}
          totalCount={totalCount}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SuggestedEmailTasksPage);
