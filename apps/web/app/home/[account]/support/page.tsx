import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { SupportTicketsPageContent } from './_components/support-tickets-page-content';
import { loadSupportPageData } from './_lib/server/support-page.loader';
import { createSupportTicketsService } from './_lib/server/support-tickets.service';

interface SupportPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Support' });

async function SupportPage({ params }: SupportPageProps) {
  const accountSlug = (await params).account;
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

  const service = createSupportTicketsService(getSupabaseServerClient());
  const initialTickets = await service.listTickets({ accountId });

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Support"
        description="Manage client support tickets"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <SupportTicketsPageContent
          accountSlug={accountSlug}
          initialTickets={initialTickets}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SupportPage);
