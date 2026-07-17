import { Suspense } from 'react';

import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { PLATFORM_EMAIL_TYPES } from '~/lib/server/send-platform-email';

import { EmailLogTable } from './_components/email-log-table';
import {
  loadEmailLogBusinessOptions,
  loadGroupedCampaignEmailLog,
  loadPlatformEmailLog,
} from './_lib/server/admin-email-log.loader';

export const metadata = {
  title: 'Email log',
};

const EMAIL_TYPES = PLATFORM_EMAIL_TYPES.map((value) => ({
  value,
  label: value.replace(/_/g, ' '),
}));

async function AdminEmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    account?: string;
    query?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const emailType = sp.type ?? '';
  const accountId = sp.account ?? '';
  const query = sp.query?.trim() ?? '';
  const currentPage = Number(sp.page ?? '1');
  const pageSize = 25;

  const [{ rows, total }, businesses, groupedCampaigns] = await Promise.all([
    loadPlatformEmailLog({
      emailType: emailType || undefined,
      accountId: accountId || undefined,
      query: query || undefined,
      page: currentPage,
      pageSize,
    }),
    loadEmailLogBusinessOptions(),
    loadGroupedCampaignEmailLog(),
  ]);

  return (
    <>
      <PageHeader
        title="Email log"
        description="Outbound platform emails — grouped campaigns or individual sends."
      />
      <PageBody>
        <Suspense
          fallback={
            <div className="text-muted-foreground">Loading email log…</div>
          }
        >
          <EmailLogTable
            rows={rows}
            groupedCampaigns={groupedCampaigns}
            total={total}
            currentPage={currentPage}
            pageSize={pageSize}
            emailTypes={EMAIL_TYPES}
            businesses={businesses}
            currentEmailType={emailType}
            currentAccountId={accountId}
            currentQuery={query}
          />
        </Suspense>
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminEmailLogPage);
