import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { EmailMarketingDashboard } from './_components/email-marketing-dashboard';
import {
  loadCampaigns,
  loadContacts,
  loadRecipientLists,
  loadUnsubscribes,
} from './_lib/server/email-marketing.loader';

export const metadata = {
  title: 'Email marketing',
};

async function EmailMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    query?: string;
    trade?: string;
    source?: string;
    list?: string;
    listQuery?: string;
  }>;
}) {
  const sp = await searchParams;
  const activeTab = sp.tab ?? 'campaigns';

  const [campaigns, contacts, unsubscribes, listsData] = await Promise.all([
    loadCampaigns(),
    loadContacts({
      query: sp.query?.trim() || undefined,
      trade: sp.trade || undefined,
      source: sp.source || undefined,
    }),
    loadUnsubscribes(),
    activeTab === 'lists'
      ? loadRecipientLists({
          list: sp.list,
          query: sp.listQuery,
        })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Email marketing"
        description="Campaigns, contacts, lists, and unsubscribes."
      />
      <PageBody>
        <EmailMarketingDashboard
          activeTab={activeTab}
          campaigns={campaigns}
          contacts={contacts}
          unsubscribes={unsubscribes}
          listsData={listsData}
          contactFilters={{
            query: sp.query?.trim() ?? '',
            trade: sp.trade ?? '',
            source: sp.source ?? '',
          }}
          listFilters={{
            list: listsData?.selectedList ?? sp.list ?? 'all_users',
            query: sp.listQuery?.trim() ?? '',
          }}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(EmailMarketingPage);
