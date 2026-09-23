import {
  escapeEmailHtml,
  renderOzerTransactionalEmail,
} from '~/lib/email/ozer-transactional-shell';

export type WorkspaceOwnerInviteEmailInput = {
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
  productName?: string;
};

/**
 * Owner invite for a workspace created before the owner has signed in.
 * Uses the shared Ozer transactional shell and the existing invite accept URL.
 */
export function renderWorkspaceOwnerInviteEmail(
  input: WorkspaceOwnerInviteEmailInput,
): { html: string; subject: string } {
  const productName = input.productName?.trim() || 'Ozer';
  const workspaceName = input.workspaceName.trim() || 'your workspace';
  const inviterName = input.inviterName.trim() || productName;
  const subject = `You're invited to own ${workspaceName} on ${productName}`;
  const heading = `You're invited as owner of ${workspaceName}`;
  const preview = `${inviterName} invited you to use ${productName} as an owner of ${workspaceName}`;
  const safeProduct = escapeEmailHtml(productName);
  const safeWorkspace = escapeEmailHtml(workspaceName);
  const safeInviter = escapeEmailHtml(inviterName);

  const bodyHtml = `
<p style="margin:0 0 16px;">Hi,</p>
<p style="margin:0 0 16px;"><strong style="color:#2A1720;">${safeInviter}</strong> has invited you to use <strong style="color:#2A1720;">${safeProduct}</strong> as an <strong style="color:#2A1720;">owner</strong> of the workspace <strong style="color:#2A1720;">${safeWorkspace}</strong>.</p>
<p style="margin:0;">Accept the invitation to set your password and open ${safeWorkspace}. The link signs you in the same way as other Ozer invitations.</p>
`.trim();

  const html = renderOzerTransactionalEmail({
    title: subject,
    preview,
    heading,
    bodyHtml,
    cta: {
      label: 'Accept invitation',
      href: input.acceptUrl,
    },
    footerNote:
      'This link expires in 30 days. If you did not expect this email, you can ignore it.',
    productName,
  });

  return { html, subject };
}
