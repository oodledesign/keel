import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { CreatePollForm } from '../../_components/create-poll-form';
import { PollOrganiserView } from '../../_components/poll-organiser-view';
import {
  type MeetingPollDetail,
  createMeetingPollsService,
} from '../../_lib/server/meeting-polls.service';
import { loadSchedulingAccess } from '../../_lib/server/scheduling-page.loader';

interface Props {
  params: Promise<{ account: string; pollId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { account, pollId } = await params;
  try {
    const access = await loadSchedulingAccess(account);
    const poll = await createMeetingPollsService(
      getSupabaseServerClient(),
    ).getPoll(access.accountId, pollId);
    return { title: poll.title };
  } catch {
    return { title: 'Meeting poll' };
  }
}

async function MeetingPollPage({ params }: Props) {
  const { account, pollId } = await params;
  const { accountId, accountSlug, canEditScheduling } =
    await loadSchedulingAccess(account);
  const service = createMeetingPollsService(getSupabaseServerClient());

  let poll: MeetingPollDetail;
  try {
    poll = await service.getPoll(accountId, pollId);
  } catch {
    notFound();
  }

  if (poll.status === 'draft' && canEditScheduling) {
    const options = await service.listFormOptions(accountId);
    return (
      <CreatePollForm
        accountId={accountId}
        accountSlug={accountSlug}
        rangeStart={poll.rangeStart}
        rangeEnd={poll.rangeEnd}
        contacts={options.contacts}
        clients={options.clients}
        projects={options.projects}
        initial={{
          pollId: poll.id,
          title: poll.title,
          description: poll.description ?? '',
          location: poll.location ?? '',
          durationMinutes: poll.durationMinutes,
          rangeStart: poll.rangeStart,
          rangeEnd: poll.rangeEnd,
          timezone: poll.timezone,
          showVoterNames: poll.showVoterNames,
          clientId: poll.clientId ?? '',
          projectId: poll.projectId ?? '',
          slots: poll.slots.map((slot) => ({
            startAtIso: slot.startsAt,
            source: slot.source,
          })),
          invitees: poll.invitees.map((invitee) => ({
            email: invitee.email,
            name: invitee.name ?? '',
            contactId: invitee.contactId,
          })),
        }}
      />
    );
  }

  return (
    <PollOrganiserView
      accountId={accountId}
      accountSlug={accountSlug}
      canEdit={canEditScheduling}
      poll={poll}
    />
  );
}

export default withI18n(MeetingPollPage);
