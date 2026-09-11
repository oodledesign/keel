import {
  resubscribeMailingListAction,
  unsubscribeMailingListAction,
} from '../_lib/server/server-actions';
import { MailingListPreferenceSubmit } from './mailing-list-preference-submit';

export function MailingListPreferenceForm({
  token,
  subscribed,
}: {
  token: string;
  subscribed: boolean;
}) {
  return (
    <form
      action={
        subscribed ? unsubscribeMailingListAction : resubscribeMailingListAction
      }
    >
      <input type="hidden" name="token" value={token} />
      <MailingListPreferenceSubmit
        variant={subscribed ? 'quiet' : 'primary'}
        label={subscribed ? 'Unsubscribe' : 'Subscribe again'}
        pendingLabel={subscribed ? 'Unsubscribing…' : 'Subscribing…'}
      />
    </form>
  );
}
