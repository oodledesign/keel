import { describe, expect, it } from 'vitest';

import { CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN } from '~/lib/campaigns/campaign-test-send';

import {
  MAILING_LIST_TEST_UNSUBSCRIBE_BODY,
  MAILING_LIST_TEST_UNSUBSCRIBE_TITLE,
  MAILING_LIST_UNSUBSCRIBE_INVALID_TITLE,
  mailingListUnsubscribePageCopy,
  mailingListUnsubscribePageKind,
} from './mailing-list-unsubscribe-page';

describe('mailing-list unsubscribe page', () => {
  it('shows calm test-email copy for campaign-test-preview and skips lookup', () => {
    expect(
      mailingListUnsubscribePageKind(CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN),
    ).toBe('test');

    const copy = mailingListUnsubscribePageCopy('test');
    expect(copy.title).toBe(MAILING_LIST_TEST_UNSUBSCRIBE_TITLE);
    expect(copy.body).toBe(MAILING_LIST_TEST_UNSUBSCRIBE_BODY);
    expect(copy.title).not.toBe(MAILING_LIST_UNSUBSCRIBE_INVALID_TITLE);
    expect(copy.body.toLowerCase()).not.toContain('invalid');
  });

  it('keeps missing tokens invalid and live tokens on the lookup path', () => {
    expect(mailingListUnsubscribePageKind(undefined)).toBe('missing_token');
    expect(mailingListUnsubscribePageKind('')).toBe('missing_token');
    expect(mailingListUnsubscribePageKind('a'.repeat(32))).toBe('lookup');

    expect(mailingListUnsubscribePageCopy('missing_token')).toEqual({
      title: MAILING_LIST_UNSUBSCRIBE_INVALID_TITLE,
      body: 'This unsubscribe link is missing or invalid.',
    });
  });
});
