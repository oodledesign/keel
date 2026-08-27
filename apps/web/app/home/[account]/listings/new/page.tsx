import { requireCommercialBillableActor } from '~/lib/commercial/require-commercial-billable-actor';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CreateDisposalOnce } from './_components/create-disposal-once';

interface PageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    name?: string;
    notes?: string;
    askingRent?: string;
    clientId?: string;
    dealId?: string;
    sopAssist?: string;
  }>;
}

async function NewDisposalPage({ params, searchParams }: PageProps) {
  const { account: slug } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  // Auth only — never insert on GET (Next.js link prefetch was creating drafts).
  await requireCommercialBillableActor(accountId, 'create or edit disposals');

  return (
    <CreateDisposalOnce
      accountId={accountId}
      accountSlug={slug}
      name={query.name}
      notes={query.notes}
      askingRent={query.askingRent}
      clientId={query.clientId}
      dealId={query.dealId}
      sopAssist={query.sopAssist}
    />
  );
}

export default withI18n(NewDisposalPage);
