import { describe, expect, it } from 'vitest';

import { CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN } from '~/lib/campaigns/campaign-test-send';

import {
  MAILING_LIST_TEST_UNSUBSCRIBE_BODY,
  MAILING_LIST_TEST_UNSUBSCRIBE_TITLE,
  MAILING_LIST_UNSUBSCRIBE_INVALID_TITLE,
  mailingListPreferencePageCopy,
  mailingListUnsubscribePageCopy,
  mailingListUnsubscribePageKind,
  shouldUnsubscribeMailingListOnPageLoad,
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

  it('keeps one-click unsubscribe when there are no public lists', () => {
    expect(shouldUnsubscribeMailingListOnPageLoad({ publicListCount: 0 })).toBe(
      true,
    );
    expect(
      shouldUnsubscribeMailingListOnPageLoad({
        publicListCount: 0,
        status: 'subscribed',
      }),
    ).toBe(false);
  });

  it('uses preference-centre copy when public lists exist', () => {
    expect(
      mailingListPreferencePageCopy({
        errorKind: null,
        email: 'dana@example.com',
        workspaceName: 'Ozer',
        subscribed: true,
        canResubscribe: true,
        preferenceCenter: true,
      }),
    ).toEqual({
      title: 'Email preferences',
      body: 'Choose which lists dana@example.com should receive from Ozer.',
    });
  });

  it('opens a preference centre when public lists exist', () => {
    expect(shouldUnsubscribeMailingListOnPageLoad({ publicListCount: 2 })).toBe(
      false,
    );
    expect(
      shouldUnsubscribeMailingListOnPageLoad({
        publicListCount: 1,
        status: 'subscribed',
      }),
    ).toBe(false);
  });
});
