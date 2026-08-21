import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { CommercialPropertyDetail } from '../_components/commercial-property-detail';
import { createCommercialPropertiesService } from '../_lib/server/commercial-properties.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => ({ title: 'Property' });

async function CommercialPropertyDetailPage({ params }: PageProps) {
  const { account: slug, id: propertyId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const service = createCommercialPropertiesService(getSupabaseServerClient());
  const property = await service.getProperty(propertyId, accountId);
  if (!property) notFound();

  const [parties, linkedListings] = await Promise.all([
    service.listParties(propertyId, accountId),
    service.listLinkedListings(propertyId, accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title={property.name} />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-3 pt-2 pb-6 lg:px-6">
        <CommercialPropertyDetail
          accountId={accountId}
          accountSlug={slug}
          property={property}
          parties={parties}
          linkedListings={linkedListings}
        />
      </PageBody>
    </>
  );
}

export default withI18n(CommercialPropertyDetailPage);
