import type { EmailRecipientList } from '~/lib/admin-email/campaigns';
import { EMAIL_RECIPIENT_LISTS } from '~/lib/admin-email/campaigns';

import { CampaignComposer } from '../_components/campaign-composer';
import {
  loadContactListsForComposer,
  loadCurrentSuperAdminEmail,
  loadCustomRecipientUsers,
} from '../_lib/server/email-marketing.loader';

export const metadata = {
  title: 'New campaign',
};

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; contactListId?: string }>;
}) {
  const sp = await searchParams;
  const listParam = sp.list?.trim();
  const contactListIdParam = sp.contactListId?.trim();

  let defaultRecipientList: EmailRecipientList | undefined;
  let defaultContactListId: string | undefined;

  if (listParam === 'contact_list' && contactListIdParam) {
    defaultRecipientList = 'contact_list';
    defaultContactListId = contactListIdParam;
  } else if (
    listParam &&
    (EMAIL_RECIPIENT_LISTS as readonly string[]).includes(listParam)
  ) {
    defaultRecipientList = listParam as EmailRecipientList;
  }

  const [customUsers, customContactLists, superAdminEmail] = await Promise.all([
    loadCustomRecipientUsers(),
    loadContactListsForComposer(),
    loadCurrentSuperAdminEmail(),
  ]);

  return (
    <CampaignComposer
      customUsers={customUsers}
      customContactLists={customContactLists}
      superAdminEmail={superAdminEmail}
      defaultRecipientList={defaultRecipientList}
      defaultContactListId={defaultContactListId}
    />
  );
}
