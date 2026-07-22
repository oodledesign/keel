import { describe, expect, it } from 'vitest';

import {
  buildPublicSeoReportPath,
  buildPublicSeoReportUrl,
  buildSeoReportPdfPath,
} from './public-url';

describe('seo report public urls', () => {
  it('builds portal and pdf paths', () => {
    expect(buildPublicSeoReportPath('abc123')).toBe('/portal/seo/abc123');
    expect(buildSeoReportPdfPath('abc123')).toBe(
      '/api/rankly/seo-report/export/abc123',
    );
    expect(buildPublicSeoReportUrl('abc123', 'https://app.ozer.so')).toBe(
      'https://app.ozer.so/portal/seo/abc123',
    );
  });
});
