import { describe, expect, it } from 'vitest';

import { safeFeedflowReturnPath } from './oauth-redirect';

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
