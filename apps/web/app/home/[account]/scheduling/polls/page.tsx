import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { PollsList } from '../_components/polls-list';
import { createMeetingPollsService } from '../_lib/server/meeting-polls.service';
import { loadSchedulingAccess } from '../_lib/server/scheduling-page.loader';

interface Props {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Meeting polls' });

async function MeetingPollsPage({ params }: Props) {
  const accountSlugParam = (await params).account;
  const { accountId, accountSlug, canEditScheduling } =
    await loadSchedulingAccess(accountSlugParam);
  const polls = await createMeetingPollsService(
    getSupabaseServerClient(),
  ).listPolls(accountId);

  return (
    <PollsList
      accountSlug={accountSlug}
      canEdit={canEditScheduling}
      polls={polls}
    />
  );
}

export default withI18n(MeetingPollsPage);
