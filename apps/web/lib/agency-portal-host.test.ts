import { describe, expect, it } from 'vitest';

import {
  buildAgencyPortalRewritePath,
  extractAgencyPortalSlug,
} from './agency-portal-host';

describe('extractAgencyPortalSlug', () => {
  it('returns slug for agency subdomains', () => {
    expect(extractAgencyPortalSlug('thistleleaf.keelos.so')).toBe('thistleleaf');
    expect(extractAgencyPortalSlug('thistleleaf.keelos.so:443')).toBe(
      'thistleleaf',
    );
  });

  it('ignores reserved subdomains and apex domain', () => {
    expect(extractAgencyPortalSlug('keelos.so')).toBeNull();
    expect(extractAgencyPortalSlug('www.keelos.so')).toBeNull();
    expect(extractAgencyPortalSlug('app.keelos.so')).toBeNull();
    expect(extractAgencyPortalSlug('staging.keelos.so')).toBeNull();
    expect(extractAgencyPortalSlug('localhost')).toBeNull();
    expect(extractAgencyPortalSlug('localhost:3000')).toBeNull();
  });
});

describe('buildAgencyPortalRewritePath', () => {
  it('rewrites root and nested paths under the portal slug', () => {
    expect(buildAgencyPortalRewritePath('thistleleaf', '/')).toBe(
      '/portal/thistleleaf',
    );
    expect(buildAgencyPortalRewritePath('thistleleaf', '/support')).toBe(
      '/portal/thistleleaf/support',
    );
    expect(buildAgencyPortalRewritePath('thistleleaf', '/portal/thistleleaf')).toBe(
      '/portal/thistleleaf',
    );
  });
});
