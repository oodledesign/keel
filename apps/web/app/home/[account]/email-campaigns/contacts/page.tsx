import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignContactsPage } from '../_components/campaign-contacts-page';
import { CampaignsHubNav } from '../_components/campaigns-hub-nav';
import { loadCampaignContactsPage } from '../_lib/server/campaigns.loader';

interface ContactsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ q?: string; category?: string; industry?: string }>;
}

export const generateMetadata = async () => ({ title: 'Campaign contacts' });

async function ContactsPage({ params, searchParams }: ContactsPageProps) {
  const accountSlug = (await params).account;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);
  const data = await loadCampaignContactsPage(workspace.account.id, {
    query: query.q,
    categoryId: query.category || null,
    industry: query.industry || null,
  });

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Contacts"
        description="Everyone in this workspace you can add to campaign lists."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        <CampaignContactsPage
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          contacts={data.contacts}
          categories={data.categories}
          lists={data.lists}
          planTier={data.snapshot.planTier}
          nextTierName={data.snapshot.nextTierName}
          initialQuery={query.q}
          initialCategoryId={query.category}
          initialIndustry={query.industry}
        />
      </PageBody>
    </>
  );
}

export default withI18n(ContactsPage);
