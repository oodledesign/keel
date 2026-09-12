import { describe, expect, it } from 'vitest';

import { buildProjectRetainerDigestBodyHtml } from './weekly-digest-email';

describe('buildProjectRetainerDigestBodyHtml', () => {
  it('includes credit totals and escapes the project title', () => {
    const html = buildProjectRetainerDigestBodyHtml({
      projectTitle: 'Acme <retainer>',
      balance: 7,
      burned: 3,
      restored: 1,
      granted: 5,
      debited: 2,
      weekStart: '2026-09-07',
    });

    expect(html).toContain('Acme &lt;retainer&gt;');
    expect(html).toContain('Credits removed');
    expect(html).toContain('3');
    expect(html).toContain('7');
    expect(html).toContain('2026-09-07');
  });
});
