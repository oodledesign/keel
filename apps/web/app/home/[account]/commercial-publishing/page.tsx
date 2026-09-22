import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { parsePublishingSettingsTab } from '~/lib/commercial/publishing-settings-tabs';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { createListingsService } from '../listings/_lib/server/listings.service';
import { RequirementFormSettingsCard } from '../requirements/_components/requirement-form-settings-card';
import { CommercialPublishingSettings } from './_components/commercial-publishing-settings';
import { loadCommercialPublishingSettings } from './_lib/server/commercial-publishing.loader';

interface CommercialPublishingPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    linkedin_error?: string;
    linkedin_connected?: string;
    linkedin_select?: string;
    tab?: string;
  }>;
}

export const generateMetadata = async () => ({
  title: 'Website & portals',
});

async function CommercialPublishingPage({
  params,
  searchParams,
}: CommercialPublishingPageProps) {
  const { account: slug } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const { getCommercialBillableSeatCount } =
    await import('~/lib/commercial/commercial-seat-access');
  const { portalPublishingAllowed } =
    await import('~/lib/billing/commercial-graduated-pricing');
  const [settings, listings, billableSeats] = await Promise.all([
    loadCommercialPublishingSettings(accountId),
    createListingsService(client).listListings(accountId),
    getCommercialBillableSeatCount(client, accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Website & portals"
        description="Website feed, portal credentials, boards, and sync activity."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 lg:px-6">
        <CommercialPublishingSettings
          accountId={accountId}
          accountSlug={slug}
          initialSettings={settings}
          listings={listings}
          portalPublishingUnlocked={portalPublishingAllowed(billableSeats)}
          initialTab={parsePublishingSettingsTab(query.tab) ?? 'website'}
          websiteLeading={<RequirementFormSettingsCard accountId={accountId} />}
          linkedinBanner={{
            error: query.linkedin_error ?? null,
            connected: query.linkedin_connected === '1',
            select: query.linkedin_select === '1',
          }}
        />
      </PageBody>
    </>
  );
}

export default withI18n(CommercialPublishingPage);
