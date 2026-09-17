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

/**
 * Campaigns workspaces with public lists use a preference centre.
 * Other workspaces keep one-click unsubscribe on first load.
 */
export function shouldUnsubscribeMailingListOnPageLoad(input: {
  publicListCount: number;
  status?: string;
}): boolean {
  if (input.status === 'subscribed') return false;
  return input.publicListCount === 0;
}

export function mailingListPreferencePageCopy(input: {
  errorKind: 'invalid' | 'failed' | null;
  email: string | null;
  workspaceName: string;
  subscribed: boolean;
  canResubscribe: boolean;
  preferenceCenter: boolean;
}): MailingListUnsubscribePageCopy {
  if (input.errorKind === 'failed') {
    return {
      title: 'Something went wrong',
      body: 'We could not update your email preference. Please try again.',
    };
  }

  if (input.errorKind === 'invalid' || !input.email) {
    return {
      title: MAILING_LIST_UNSUBSCRIBE_INVALID_TITLE,
      body: MAILING_LIST_UNSUBSCRIBE_INVALID_BODY,
    };
  }

  if (input.preferenceCenter) {
    return {
      title: 'Email preferences',
      body: input.canResubscribe
        ? `Choose which lists ${input.email} should receive from ${input.workspaceName}.`
        : `${input.email} cannot be resubscribed because it was suppressed after a bounce or complaint.`,
    };
  }

  if (input.subscribed) {
    return {
      title: "You're subscribed again",
      body: `${input.email} will receive mailing-list emails from ${input.workspaceName} again.`,
    };
  }

  return {
    title: 'You have been unsubscribed',
    body: `${input.email} will no longer receive mailing-list emails from ${input.workspaceName}.`,
  };
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
