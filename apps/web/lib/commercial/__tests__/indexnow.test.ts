import { describe, expect, it, vi } from 'vitest';

import {
  INDEXNOW_ENDPOINT,
  buildIndexNowPlan,
  generateIndexNowKey,
  indexNowEligibleListingUrl,
  indexNowKeyLocation,
  indexNowStateAfterAttempt,
  isValidIndexNowKey,
  parseIndexNowState,
  postIndexNowSubmission,
  resolveIndexNowWebsiteHost,
} from '../indexnow';

const KEY = '0123456789abcdef0123456789abcdef';
const HOST = 'www.bracketts.co.uk';
const URL = `https://${HOST}/property/lonsdale-gate/`;

const live = {
  onMarket: true,
  websiteFeedIncluded: true,
  key: KEY,
  listingUrlTemplate: `https://${HOST}/property/{slug}/`,
  websiteUrl: URL,
};

describe('generateIndexNowKey', () => {
  it('returns an IndexNow-safe key', () => {
    const key = generateIndexNowKey();
    expect(isValidIndexNowKey(key)).toBe(true);
    expect(key).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('resolveIndexNowWebsiteHost', () => {
  it('prefers the listing URL template host', () => {
    expect(
      resolveIndexNowWebsiteHost({
        listingUrlTemplate: `https://${HOST}/property/{slug}/`,
        siteUrl: 'https://other.example.com',
      }),
    ).toBe(HOST);
  });

  it('falls back to the Property Hive site URL', () => {
    expect(
      resolveIndexNowWebsiteHost({
        siteUrl: `https://${HOST}/`,
      }),
    ).toBe(HOST);
  });

  it('rejects http origins and local hosts', () => {
    expect(
      resolveIndexNowWebsiteHost({
        listingUrlTemplate: 'http://www.bracketts.co.uk/property/{slug}/',
      }),
    ).toBeNull();
    expect(
      resolveIndexNowWebsiteHost({
        siteUrl: 'https://localhost/property',
      }),
    ).toBeNull();
  });
});

describe('indexNowEligibleListingUrl', () => {
  it('accepts an https page on the website host', () => {
    expect(indexNowEligibleListingUrl(URL, HOST)).toBe(URL);
  });

  it('rejects other hosts, http, and feed URLs', () => {
    expect(
      indexNowEligibleListingUrl('https://example.com/property/foo/', HOST),
    ).toBeNull();
    expect(
      indexNowEligibleListingUrl(
        'http://www.bracketts.co.uk/property/foo/',
        HOST,
      ),
    ).toBeNull();
    expect(
      indexNowEligibleListingUrl(
        'https://www.bracketts.co.uk/api/commercial/property-hive-feed?token=abc',
        HOST,
      ),
    ).toBeNull();
  });
});

describe('buildIndexNowPlan', () => {
  it('builds a root keyLocation submission for a live listing URL', () => {
    const plan = buildIndexNowPlan(live);
    expect(plan).toEqual({
      action: 'submit',
      url: URL,
      submission: {
        host: HOST,
        key: KEY,
        keyLocation: indexNowKeyLocation(HOST, KEY),
        urlList: [URL],
      },
    });
  });

  it('skips until the listing is on the website with a confident URL', () => {
    expect(buildIndexNowPlan({ ...live, onMarket: false }).action).toBe('skip');
    expect(
      buildIndexNowPlan({ ...live, websiteFeedIncluded: false }),
    ).toMatchObject({ action: 'skip', reason: 'website_excluded' });
    expect(buildIndexNowPlan({ ...live, key: null })).toMatchObject({
      action: 'skip',
      reason: 'no_key',
    });
    expect(
      buildIndexNowPlan({ ...live, websiteUrl: 'https://example.com/x' }),
    ).toMatchObject({ action: 'skip', reason: 'url_not_eligible' });
  });

  it('does not resubmit a URL IndexNow already accepted', () => {
    expect(
      buildIndexNowPlan({
        ...live,
        state: { url: URL, submittedAt: '2026-09-01T00:00:00.000Z' },
      }),
    ).toMatchObject({ action: 'skip', reason: 'already_submitted' });
  });

  it('submits again when the public URL changes', () => {
    const next = `https://${HOST}/property/new-unit/`;
    const plan = buildIndexNowPlan({
      ...live,
      websiteUrl: next,
      state: { url: URL, submittedAt: '2026-09-01T00:00:00.000Z' },
    });
    expect(plan).toMatchObject({ action: 'submit', url: next });
  });

  it('debounces a failed attempt for the same URL', () => {
    const now = new Date('2026-09-24T12:00:00.000Z');
    expect(
      buildIndexNowPlan({
        ...live,
        now,
        state: {
          attemptUrl: URL,
          attemptAt: '2026-09-24T11:50:00.000Z',
        },
      }),
    ).toMatchObject({ action: 'skip', reason: 'recent_attempt' });

    expect(
      buildIndexNowPlan({
        ...live,
        now,
        state: {
          attemptUrl: URL,
          attemptAt: '2026-09-24T11:00:00.000Z',
        },
      }).action,
    ).toBe('submit');
  });
});

describe('indexNowStateAfterAttempt', () => {
  it('keeps the last success when a later URL fails', () => {
    const next = indexNowStateAfterAttempt({
      previous: {
        url: URL,
        submittedAt: '2026-09-01T00:00:00.000Z',
      },
      url: `https://${HOST}/property/new/`,
      ok: false,
      at: new Date('2026-09-24T12:00:00.000Z'),
    });
    expect(next.url).toBe(URL);
    expect(next.attemptUrl).toBe(`https://${HOST}/property/new/`);
  });
});

describe('parseIndexNowState', () => {
  it('ignores malformed blobs', () => {
    expect(parseIndexNowState(null)).toEqual({});
    expect(parseIndexNowState({ url: ' https://x ', attemptAt: 12 })).toEqual({
      url: 'https://x',
    });
  });
});

describe('postIndexNowSubmission', () => {
  it('posts the IndexNow JSON body and treats 200 and 202 as success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 202,
      text: async () => 'Accepted',
    });
    const submission = {
      host: HOST,
      key: KEY,
      keyLocation: indexNowKeyLocation(HOST, KEY),
      urlList: [URL],
    };
    const result = await postIndexNowSubmission(submission, fetchImpl);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      INDEXNOW_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(submission),
      }),
    );

    fetchImpl.mockResolvedValueOnce({
      status: 403,
      text: async () => 'Invalid key',
    });
    const denied = await postIndexNowSubmission(submission, fetchImpl);
    expect(denied).toMatchObject({ ok: false, status: 403 });
  });
});
