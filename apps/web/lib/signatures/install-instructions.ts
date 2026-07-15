export type SignatureInstallStep = {
  id: string;
  title: string;
  body: string;
};

/** Outlook (classic + new) install steps for self-serve HTML signatures. */
export const OUTLOOK_INSTALL_STEPS: SignatureInstallStep[] = [
  {
    id: 'open',
    title: 'Check your signature',
    body: 'You’re on your personal install page. Use the mock email on the right to confirm name, title, and details look right before you install.',
  },
  {
    id: 'download',
    title: 'Download your signature',
    body: 'Copy the HTML below or download the .htm file. You’ll paste it into Outlook in the next steps.',
  },
  {
    id: 'outlook',
    title: 'Open Outlook signature settings',
    body: 'Find Signatures in Outlook using the path that matches your app version.',
  },
  {
    id: 'paste',
    title: 'Create or replace your signature',
    body: 'Create a new signature (or edit your current one). Open the downloaded .htm file in a browser, select the signature block, copy it, and paste it into the Outlook signature editor. Avoid pasting into plain-text mode.',
  },
  {
    id: 'default',
    title: 'Set it as default',
    body: 'Choose this signature for new messages and replies/forwards if you want it everywhere. Send a test email to yourself to confirm spacing and images look correct.',
  },
];

export function buildSignatureInstallEmail(params: {
  recipientName: string | null;
  accountName: string | null;
  installUrl: string;
  fromWorkspaceName?: string | null;
}): { subject: string; text: string; html: string } {
  const first = params.recipientName?.trim().split(/\s+/)[0] || 'there';
  const workspace =
    params.accountName?.trim() ||
    params.fromWorkspaceName?.trim() ||
    'your company';

  const subject = `Install your ${workspace} email signature`;

  const text = [
    `Hi ${first},`,
    ``,
    `Your email signature for ${workspace} is ready.`,
    ``,
    `Open this page to preview it in a mock email, download the HTML file, and follow the short Outlook install steps:`,
    params.installUrl,
    ``,
    `You’ll add the signature yourself in Outlook — nothing is changed in your mailbox until you install it.`,
    ``,
    `If anything looks off, reply to this email and we’ll help.`,
    ``,
    `Thanks,`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#FBF6EC;color:#351E28;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF6EC;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid rgba(53,30,40,0.12);border-radius:16px;padding:28px 24px;">
          <tr><td style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#B7A4AC;font-weight:600;">Email signature</td></tr>
          <tr><td style="padding-top:10px;font-size:22px;font-weight:700;line-height:1.25;">Hi ${escapeHtml(first)},</td></tr>
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#351E28;">
            Your email signature for <strong>${escapeHtml(workspace)}</strong> is ready. Open the page below to preview it, download the HTML, and follow the step-by-step Outlook guide.
          </td></tr>
          <tr><td style="padding-top:22px;" align="center">
            <a href="${escapeHtml(params.installUrl)}" style="display:inline-block;background:#FF5C34;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">
              View &amp; install signature
            </a>
          </td></tr>
          <tr><td style="padding-top:18px;font-size:13px;line-height:1.5;color:#B7A4AC;">
            Or paste this link into your browser:<br />
            <a href="${escapeHtml(params.installUrl)}" style="color:#41606F;word-break:break-all;">${escapeHtml(params.installUrl)}</a>
          </td></tr>
          <tr><td style="padding-top:18px;font-size:13px;line-height:1.5;color:#351E28;">
            You’ll add the signature yourself in Outlook — nothing changes in your mailbox until you install it.
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
