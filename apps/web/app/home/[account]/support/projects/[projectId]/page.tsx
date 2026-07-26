import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { getDefaultAccountPath } from '../../../_lib/role-access';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { SupportTicketsPageContent } from '../../_components/support-tickets-page-content';
import { loadSupportPageData } from '../../_lib/server/support-page.loader';
import { createSupportTicketsService } from '../../_lib/server/support-tickets.service';

interface SupportProjectPageProps {
  params: Promise<{ account: string; projectId: string }>;
}

export const generateMetadata = async () => ({ title: 'Project support' });

async function SupportProjectPage({ params }: SupportProjectPageProps) {
  const { account: accountSlug, projectId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  const { accountId, canViewSupport } = await loadSupportPageData(accountSlug);

  if (!canViewSupport) {
    redirect(
      getDefaultAccountPath(
        accountSlug,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const client = getSupabaseServerClient();
  const { data: projectRow, error: projectError } = await client
    .from('projects')
    .select('id, name, title')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (projectError || !projectRow) {
    notFound();
  }

  const projectName =
    (
      projectRow as { name?: string | null; title?: string | null }
    ).name?.trim() ||
    (
      projectRow as { name?: string | null; title?: string | null }
    ).title?.trim() ||
    'Project';

  const service = createSupportTicketsService(client);
  const initialTickets = await service.listTickets({ accountId, projectId });

  const backHref = pathsConfig.app.accountSupport.replace(
    '[account]',
    accountSlug,
  );

  return (
    <>
      <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <SupportTicketsPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          initialTickets={initialTickets}
          pageTitle={`${projectName} · Support`}
          backHref={backHref}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SupportProjectPage);
