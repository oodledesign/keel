import { describe, expect, it } from 'vitest';

import {
  pathnameOnly,
  resolveFeedflowErrorPath,
  safeFeedflowReturnPath,
  sameOriginRefererPath,
  workspaceSlugFromAppPath,
} from './oauth-redirect';

describe('safeFeedflowReturnPath', () => {
  it('accepts in-app paths', () => {
    expect(safeFeedflowReturnPath('/app/acme/social/accounts')).toBe(
      '/app/acme/social/accounts',
    );
  });

  it('rejects protocol-relative and external paths', () => {
    expect(safeFeedflowReturnPath('//evil.example/phish')).toBeNull();
    expect(safeFeedflowReturnPath('https://evil.example')).toBeNull();
    expect(safeFeedflowReturnPath(null)).toBeNull();
  });
});

describe('workspaceSlugFromAppPath', () => {
  it('reads the workspace slug', () => {
    expect(workspaceSlugFromAppPath('/app/oodle-design/social/accounts')).toBe(
      'oodle-design',
    );
  });

  it('ignores reserved /app segments', () => {
    expect(workspaceSlugFromAppPath('/app/settings')).toBeNull();
  });
});

describe('sameOriginRefererPath', () => {
  it('keeps same-origin app paths', () => {
    expect(
      sameOriginRefererPath(
        'https://app.ozer.so',
        'https://app.ozer.so/app/oodle-design/social/accounts',
      ),
    ).toBe('/app/oodle-design/social/accounts');
  });

  it('rejects other origins', () => {
    expect(
      sameOriginRefererPath(
        'https://app.ozer.so',
        'https://www.instagram.com/oauth/authorize',
      ),
    ).toBeNull();
  });
});

describe('resolveFeedflowErrorPath', () => {
  const origin = 'https://app.ozer.so';

  it('prefers the social-accounts return path', () => {
    expect(
      resolveFeedflowErrorPath({
        origin,
        returnParam: '/app/oodle-design/social/accounts',
      }),
    ).toBe('/app/oodle-design/social/accounts');
  });

  it('does not use bare /app even when that is the return', () => {
    expect(
      resolveFeedflowErrorPath({
        origin,
        returnParam: '/app',
        referer: 'https://app.ozer.so/app/oodle-design/social/accounts',
      }),
    ).toBe('/app/oodle-design/social/accounts');
  });

  it('maps a workspace referer to social accounts', () => {
    expect(
      resolveFeedflowErrorPath({
        origin,
        returnParam: '/app',
        referer: 'https://app.ozer.so/app/oodle-design/invoices',
      }),
    ).toBe('/app/oodle-design/social/accounts');
  });

  it('falls back to explicit personal home when nothing else is safe', () => {
    expect(
      resolveFeedflowErrorPath({
        origin,
        returnParam: '/app',
      }),
    ).toBe('/app?personal=1');
  });

  it('uses a known slug when referer is missing', () => {
    expect(
      resolveFeedflowErrorPath({
        origin,
        returnParam: '/app',
        slug: 'oodle-design',
      }),
    ).toBe('/app/oodle-design/social/accounts');
  });
});

describe('pathnameOnly', () => {
  it('strips query and hash', () => {
    expect(pathnameOnly('/app/acme?x=1#y')).toBe('/app/acme');
  });
});
