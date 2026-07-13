import { describe, expect, it } from 'vitest';

import {
  renderOzerEmailCta,
  renderOzerTransactionalEmail,
} from './ozer-transactional-shell';

describe('ozer transactional email shell', () => {
  it('renders branded shell with logo, heading, and coral CTA', () => {
    const html = renderOzerTransactionalEmail({
      title: 'Invite',
      preview: 'You are invited',
      heading: "You're invited",
      bodyHtml: '<p>Hello Aimee</p>',
      cta: { label: 'Accept invitation', href: 'https://ozer.so/join' },
      productName: 'Ozer',
    });

    expect(html).toContain('ozer-wordmark-dark.png');
    expect(html).toContain("You're invited");
    expect(html).toContain('Hello Aimee');
    expect(html).toContain('#FF5C34');
    expect(html).toContain('Accept invitation');
    expect(html).toContain('https://ozer.so/join');
  });

  it('escapes CTA label and href', () => {
    const cta = renderOzerEmailCta('Click <here>', 'https://ozer.so/?a=1&b=2');
    expect(cta).toContain('Click &lt;here&gt;');
    expect(cta).toContain('https://ozer.so/?a=1&amp;b=2');
  });
});
