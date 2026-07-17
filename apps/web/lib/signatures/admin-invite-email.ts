export function providerLabel(provider: string) {
  return provider === 'google' ? 'Google Workspace' : 'Microsoft 365';
}

export function buildSignaturesAdminInviteEmail(params: {
  accountName: string;
  provider: 'microsoft' | 'google';
  url: string;
  expiresAt?: string | null;
}): { subject: string; body: string } {
  const provider = providerLabel(params.provider);
  const workspace = params.accountName.trim() || 'our workspace';
  const expiresLine = params.expiresAt
    ? `This link expires on ${new Date(params.expiresAt).toLocaleDateString(
        'en-GB',
        {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        },
      )} and can only be used once.`
    : 'This link expires in 7 days and can only be used once.';

  const subject = `Please connect ${provider} for ${workspace} email signatures`;

  const body = [
    `Hi,`,
    ``,
    `Could you help us connect ${provider} so we can manage company email signatures in Ozer for ${workspace}?`,
    ``,
    `Please open this secure one-time link and follow the short setup steps:`,
    params.url,
    ``,
    expiresLine,
    ``,
    `You do not need an Ozer account — the link is only for completing the ${provider} connection. Once connected, our team will manage signatures from Ozer.`,
    ``,
    `If you have any questions, just reply to this email.`,
    ``,
    `Thanks,`,
  ].join('\n');

  return { subject, body };
}
