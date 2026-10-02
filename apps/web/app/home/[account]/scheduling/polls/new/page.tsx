import {
  addCalendarDaysInTimeZone,
  formatYmdInTimeZone,
} from '@kit/scheduling';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { CreatePollForm } from '../../_components/create-poll-form';
import { createMeetingPollsService } from '../../_lib/server/meeting-polls.service';
import { loadSchedulingAccess } from '../../_lib/server/scheduling-page.loader';

interface Props {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'New meeting poll' });

async function NewMeetingPollPage({ params }: Props) {
  const accountSlugParam = (await params).account;
  const { accountId, accountSlug, canEditScheduling } =
    await loadSchedulingAccess(accountSlugParam);

  if (!canEditScheduling) {
    return <p>You can view polls, but you cannot create one.</p>;
  }

  const options = await createMeetingPollsService(
    getSupabaseServerClient(),
  ).listFormOptions(accountId);
  const timezone = 'Europe/London';
  const now = new Date();

  return (
    <CreatePollForm
      accountId={accountId}
      accountSlug={accountSlug}
      rangeStart={formatYmdInTimeZone(now, timezone)}
      rangeEnd={formatYmdInTimeZone(
        addCalendarDaysInTimeZone(now, 7, timezone),
        timezone,
      )}
      contacts={options.contacts}
      clients={options.clients}
      projects={options.projects}
    />
  );
}

export default withI18n(NewMeetingPollPage);
