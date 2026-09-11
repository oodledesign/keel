import { CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN } from '~/lib/campaigns/campaign-test-send';

export const MAILING_LIST_UNSUBSCRIBE_INVALID_TITLE =
  'Invalid unsubscribe link';
export const MAILING_LIST_UNSUBSCRIBE_INVALID_BODY =
  'This unsubscribe link is missing or invalid.';

export const MAILING_LIST_TEST_UNSUBSCRIBE_TITLE = 'This is a test email';
export const MAILING_LIST_TEST_UNSUBSCRIBE_BODY =
  'This is a test email — unsubscribe is disabled.';

export type MailingListUnsubscribePageKind =
  | 'test'
  | 'missing_token'
  | 'lookup';

export type MailingListUnsubscribePageCopy = {
  title: string;
  body: string;
};

/**
 * Decide how `/unsubscribe/mailing-list` should treat a token before any
 * preference lookup. Test-preview tokens must never mint or change a row.
 */
export function mailingListUnsubscribePageKind(
  token: string | undefined,
): MailingListUnsubscribePageKind {
  if (!token) return 'missing_token';
  if (token === CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN) return 'test';
  return 'lookup';
}

export function mailingListUnsubscribePageCopy(
  kind: Exclude<MailingListUnsubscribePageKind, 'lookup'>,
): MailingListUnsubscribePageCopy {
  if (kind === 'test') {
    return {
      title: MAILING_LIST_TEST_UNSUBSCRIBE_TITLE,
      body: MAILING_LIST_TEST_UNSUBSCRIBE_BODY,
    };
  }

  return {
    title: MAILING_LIST_UNSUBSCRIBE_INVALID_TITLE,
    body: MAILING_LIST_UNSUBSCRIBE_INVALID_BODY,
  };
}
