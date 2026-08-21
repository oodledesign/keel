import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';
import { Skeleton } from '@kit/ui/skeleton';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { ListingsList } from './_components/listings-list';
import { loadDisposalsPageData } from './_lib/server/disposals-page.loader';

interface ListingsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ office?: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Disposals` };
};

function DisposalsListSkeleton() {
  return (
    <div className="space-y-6 px-4 lg:px-0">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/3] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function DisposalsListBody({
  accountSlug,
  officeParam,
}: {
  accountSlug: string;
  officeParam: string | null;
}) {
  const data = await loadDisposalsPageData(accountSlug, officeParam);

  return (
    <ListingsList
      accountId={data.accountId}
      accountSlug={data.accountSlug}
      initialListings={data.listings}
      initialTotal={data.total}
      offices={data.offices}
      initialOfficeId={data.initialOfficeId}
      unassignedCount={data.unassignedCount}
    />
  );
}

async function ListingsPage({ params, searchParams }: ListingsPageProps) {
  const { account: slug } = await params;
  const { office: officeParam } = await searchParams;

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title="Disposals" />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <Suspense fallback={<DisposalsListSkeleton />}>
          <DisposalsListBody
            accountSlug={slug}
            officeParam={officeParam ?? null}
          />
        </Suspense>
      </PageBody>
    </>
  );
}

export default withI18n(ListingsPage);
