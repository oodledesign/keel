import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { DisposalsListSkeleton } from './_components/disposals-list-skeleton';
import { ListingsList } from './_components/listings-list';
import { loadDisposalsPageData } from './_lib/server/disposals-page.loader';

interface ListingsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    office?: string;
    status?: string;
    agent?: string;
    needsLocation?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Disposals` };
};

function DisposalsPageSkeleton() {
  return (
    <div className="space-y-6 px-4 lg:px-0">
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--workspace-shell-sidebar-accent)]" />
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
        </div>
      </div>
      <DisposalsListSkeleton />
    </div>
  );
}

async function DisposalsListBody({
  accountSlug,
  officeParam,
  statusParam,
  agentParam,
  needsLocationParam,
}: {
  accountSlug: string;
  officeParam: string | null;
  statusParam: string | null;
  agentParam: string | null;
  needsLocationParam: boolean;
}) {
  const data = await loadDisposalsPageData(accountSlug, {
    office: officeParam,
    status: statusParam,
    agent: agentParam,
  });

  return (
    <ListingsList
      accountId={data.accountId}
      accountSlug={data.accountSlug}
      initialListings={data.listings}
      initialTotal={data.total}
      offices={data.offices}
      members={data.members}
      initialOfficeId={data.initialOfficeId}
      initialStatusFilter={data.initialStatusFilter}
      initialAgentUserId={data.initialAgentUserId}
      initialNeedsLocation={needsLocationParam}
      unassignedCount={data.unassignedCount}
      canEditDisposals={data.canEditDisposals}
    />
  );
}

async function ListingsPage({ params, searchParams }: ListingsPageProps) {
  const { account: slug } = await params;
  const {
    office: officeParam,
    status: statusParam,
    agent: agentParam,
    needsLocation: needsLocationParam,
  } = await searchParams;

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title="Disposals" />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <Suspense fallback={<DisposalsPageSkeleton />}>
          <DisposalsListBody
            accountSlug={slug}
            officeParam={officeParam ?? null}
            statusParam={statusParam ?? null}
            agentParam={agentParam ?? null}
            needsLocationParam={needsLocationParam === '1'}
          />
        </Suspense>
      </PageBody>
    </>
  );
}

export default withI18n(ListingsPage);
