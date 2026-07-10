import { describe, expect, it } from 'vitest';

import { buildSignaturesAdminInviteEmail } from './admin-invite-email';

describe('buildSignaturesAdminInviteEmail', () => {
  it('includes provider, workspace, and link', () => {
    const email = buildSignaturesAdminInviteEmail({
      accountName: 'Acme Agency',
      provider: 'microsoft',
      url: 'https://app.ozer.so/connect/signatures/abc',
      expiresAt: '2026-07-17T12:00:00.000Z',
    });

    expect(email.subject).toContain('Microsoft 365');
    expect(email.subject).toContain('Acme Agency');
    expect(email.body).toContain('https://app.ozer.so/connect/signatures/abc');
    expect(email.body).toContain('Microsoft 365');
    expect(email.body).toContain('Acme Agency');
    expect(email.body).toMatch(/expires on/i);
  });

  it('uses Google Workspace wording', () => {
    const email = buildSignaturesAdminInviteEmail({
      accountName: 'Studio',
      provider: 'google',
      url: 'https://example.com/invite',
    });

    expect(email.subject).toContain('Google Workspace');
    expect(email.body).toContain('Google Workspace');
  });
});
