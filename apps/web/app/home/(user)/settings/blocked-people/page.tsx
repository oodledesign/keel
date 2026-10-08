import { withI18n } from '~/lib/i18n/with-i18n';
import { listBlockedChatUsers } from '~/lib/messages/message-safety';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { BlockedPeopleList } from './_components/blocked-people-list';

export const generateMetadata = async () => {
  return { title: 'Blocked people' };
};

async function BlockedPeopleSettingsPage() {
  const user = await requireUserInServerComponent();
  const people = await listBlockedChatUsers(user.id);

  return <BlockedPeopleList initialPeople={people} />;
}

export default withI18n(BlockedPeopleSettingsPage);
