import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LINKEDIN_API_VERSION,
  buildLinkedInCreatePostPayload,
  createLinkedInOrganizationPost,
  initializeLinkedInImageUpload,
  organizationUrn,
} from './linkedin-api';

describe('organizationUrn', () => {
  it('normalises a numeric org id', () => {
    expect(organizationUrn('5515715')).toBe('urn:li:organization:5515715');
    expect(organizationUrn('urn:li:organization:5515715')).toBe(
      'urn:li:organization:5515715',
    );
  });
});

describe('buildLinkedInCreatePostPayload', () => {
  it('builds a Posts API image payload for a single image', () => {
    const payload = buildLinkedInCreatePostPayload({
      organizationUrn: '5515715',
      commentary: 'To let in Tonbridge.\n\nhttps://www.bracketts.co.uk/p/1',
      imageUrns: ['urn:li:image:C4E10AQFoyyAjHPMQuQ'],
      imageAltTexts: ['Unit exterior'],
    });

    expect(payload.author).toBe('urn:li:organization:5515715');
    expect(payload.author.startsWith('urn:li:person:')).toBe(false);
    expect(payload.visibility).toBe('PUBLIC');
    expect(payload.lifecycleState).toBe('PUBLISHED');
    expect(payload.distribution.feedDistribution).toBe('MAIN_FEED');
    expect(payload.content).toEqual({
      media: {
        id: 'urn:li:image:C4E10AQFoyyAjHPMQuQ',
        altText: 'Unit exterior',
      },
    });
  });

  it('builds a MultiImage payload for 2–20 images', () => {
    const payload = buildLinkedInCreatePostPayload({
      organizationUrn: 'urn:li:organization:2414183',
      commentary: 'Gallery',
      imageUrns: ['urn:li:image:aaa', 'urn:li:image:bbb', 'urn:li:image:ccc'],
    });

    expect(payload.content).toEqual({
      multiImage: {
        images: [
          { id: 'urn:li:image:aaa', altText: undefined },
          { id: 'urn:li:image:bbb', altText: undefined },
          { id: 'urn:li:image:ccc', altText: undefined },
        ],
      },
    });
  });

  it('omits content for a text-only post', () => {
    const payload = buildLinkedInCreatePostPayload({
      organizationUrn: '1',
      commentary: 'Text only',
      imageUrns: [],
    });
    expect(payload.content).toBeUndefined();
  });

  it('caps images at 20', () => {
    const urns = Array.from({ length: 25 }, (_, i) => `urn:li:image:${i}`);
    const payload = buildLinkedInCreatePostPayload({
      organizationUrn: '1',
      commentary: 'Many',
      imageUrns: urns,
    });
    expect(
      payload.content && 'multiImage' in payload.content
        ? payload.content.multiImage.images
        : [],
    ).toHaveLength(20);
  });
});

describe('LinkedIn request headers and fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initializes an image upload with versioned headers and org owner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          value: {
            uploadUrl: 'https://www.linkedin.com/dms-uploads/x',
            image: 'urn:li:image:C4E10AQF',
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await initializeLinkedInImageUpload(
      'token-1',
      'urn:li:organization:5583111',
    );

    expect(result.imageUrn).toBe('urn:li:image:C4E10AQF');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.linkedin.com/rest/images?action=initializeUpload',
    );
    const headers = new Headers(init.headers);
    expect(headers.get('Linkedin-Version')).toBe(LINKEDIN_API_VERSION);
    expect(headers.get('X-Restli-Protocol-Version')).toBe('2.0.0');
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(JSON.parse(String(init.body))).toEqual({
      initializeUploadRequest: { owner: 'urn:li:organization:5583111' },
    });
  });

  it('creates a post and reads the URN from x-restli-id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({
        'x-restli-id': 'urn:li:share:6844785523593134080',
      }),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const urn = await createLinkedInOrganizationPost('token-1', {
      author: 'urn:li:organization:5515715',
      commentary: 'Sample',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    });

    expect(urn).toBe('urn:li:share:6844785523593134080');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.linkedin.com/rest/posts');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as { author: string };
    expect(body.author).toBe('urn:li:organization:5515715');
  });
});
