import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INSTAGRAM_FEEDFLOW_SCOPE,
  buildInstagramAuthUrl,
  parseInstagramRateLimit,
} from './instagram';
import { displayMediaForPost } from './instagram-display';

describe('buildInstagramAuthUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('authorizes at Instagram with instagram_business_basic only', () => {
    vi.stubEnv('FEEDFLOW_INSTAGRAM_APP_ID', '123456');
    vi.stubEnv('FEEDFLOW_INSTAGRAM_APP_SECRET', 'secret');
    vi.stubEnv(
      'FEEDFLOW_INSTAGRAM_REDIRECT_URI',
      'https://app.ozer.so/api/feedflow/auth/instagram/callback',
    );

    const url = new URL(buildInstagramAuthUrl('state-token'));

    expect(url.origin + url.pathname).toBe(
      'https://www.instagram.com/oauth/authorize',
    );
    expect(url.searchParams.get('client_id')).toBe('123456');
    expect(url.searchParams.get('scope')).toBe(INSTAGRAM_FEEDFLOW_SCOPE);
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.ozer.so/api/feedflow/auth/instagram/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.href).not.toContain('facebook.com');
    expect(url.searchParams.get('scope')).not.toContain('pages_show_list');
    expect(url.searchParams.get('scope')).not.toContain('instagram_basic');
  });
});

describe('parseInstagramRateLimit', () => {
  it('pauses when x-app-usage call_count is high', () => {
    const headers = new Headers({
      'x-app-usage': JSON.stringify({ call_count: 91, total_cputime: 10 }),
    });

    expect(parseInstagramRateLimit(headers)).toEqual({
      callCount: 91,
      retryAfterSeconds: null,
      shouldPause: true,
    });
  });

  it('pauses when Retry-After is present', () => {
    const headers = new Headers({ 'retry-after': '30' });
    expect(parseInstagramRateLimit(headers).shouldPause).toBe(true);
    expect(parseInstagramRateLimit(headers).retryAfterSeconds).toBe(30);
  });

  it('does not pause on light usage', () => {
    const headers = new Headers({
      'x-app-usage': JSON.stringify({ call_count: 12 }),
    });
    expect(parseInstagramRateLimit(headers).shouldPause).toBe(false);
  });
});

describe('displayMediaForPost', () => {
  it('uses the image URL for IMAGE posts', () => {
    expect(
      displayMediaForPost({
        media_type: 'IMAGE',
        media_url: 'https://cdn.example/photo.jpg',
        thumbnail_url: 'https://cdn.example/thumb.jpg',
      }),
    ).toEqual({ src: 'https://cdn.example/photo.jpg', isVideo: false });
  });

  it('prefers the thumbnail for VIDEO posts', () => {
    expect(
      displayMediaForPost({
        media_type: 'VIDEO',
        media_url: 'https://cdn.example/clip.mp4',
        thumbnail_url: 'https://cdn.example/poster.jpg',
      }),
    ).toEqual({ src: 'https://cdn.example/poster.jpg', isVideo: true });
  });

  it('uses the first carousel child', () => {
    expect(
      displayMediaForPost({
        media_type: 'CAROUSEL_ALBUM',
        media_url: null,
        children: [
          {
            id: 'c1',
            media_type: 'IMAGE',
            media_url: 'https://cdn.example/child.jpg',
          },
        ],
      }),
    ).toEqual({ src: 'https://cdn.example/child.jpg', isVideo: false });
  });
});
