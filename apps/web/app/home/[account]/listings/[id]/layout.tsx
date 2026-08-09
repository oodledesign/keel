import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { ListingDetailShell } from '../_components/listing-detail-shell';
import { createListingsService } from '../_lib/server/listings.service';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ account: string; id: string }>;
}

async function ListingDetailLayout({ children, params }: LayoutProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const service = createListingsService(getSupabaseServerClient());
  const listing = await service.getListing(listingId, accountId);

  if (!listing) {
    notFound();
  }

  return (
    <>
      <div className="hidden px-4 pt-4 pb-1 lg:block lg:px-6">
        <Link
          href={pathsConfig.app.accountListings.replace('[account]', slug)}
          className="text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-accent-text)]"
        >
          ← Back to disposals
        </Link>
      </div>
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-3 pb-6 lg:px-6">
        <ListingDetailShell listing={listing} accountSlug={slug}>
          {children}
        </ListingDetailShell>
      </PageBody>
    </>
  );
}

export default withI18n(ListingDetailLayout);
