import { notFound, redirect } from 'next/navigation';

import { CampaignComposer } from '../../_components/campaign-composer';
import {
  loadCampaign,
  loadContactListsForComposer,
  loadCurrentSuperAdminEmail,
  loadCustomRecipientUsers,
} from '../../_lib/server/email-marketing.loader';

export const metadata = {
  title: 'Edit campaign',
};

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, customUsers, customContactLists, superAdminEmail] =
    await Promise.all([
      loadCampaign(id),
      loadCustomRecipientUsers(),
      loadContactListsForComposer(),
      loadCurrentSuperAdminEmail(),
    ]);

  if (!campaign) {
    notFound();
  }

  if (campaign.status !== 'draft') {
    redirect(`/admin/email-marketing/${id}`);
  }

  return (
    <CampaignComposer
      campaign={campaign}
      customUsers={customUsers}
      customContactLists={customContactLists}
      superAdminEmail={superAdminEmail}
    />
  );
}
