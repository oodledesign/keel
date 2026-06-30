import 'server-only';

import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadAccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';

import {
  DEFAULT_PROPOSAL_EMAIL_BODY,
  DEFAULT_PROPOSAL_EMAIL_SIGNATURE,
  DEFAULT_PROPOSAL_EMAIL_SUBJECT,
  renderSmartFields,
} from '../doc-smart-fields';

function formatPence(pence: number, currency = 'gbp') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(pence / 100);
}

export async function sendProposalIssuedEmail(params: {
  accountId: string;
  proposalId: string;
  recipientEmail: string;
  testOnly?: boolean;
  sender?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
}) {
  const sender = process.env.EMAIL_SENDER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender || !siteUrl) {
    return;
  }

  const admin = getSupabaseServerAdminClient();
  const { data: proposal, error: proposalError } = await admin
    .from('proposals')
    .select(
      'id, account_id, client_id, deal_id, title, total_pence, currency, expires_at, public_token, recipient_name, email_subject, email_body, email_signature',
    )
    .eq('id', params.proposalId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (proposalError || !proposal?.public_token) {
    return;
  }

  const [{ data: account }, clientResult, dealResult] = await Promise.all([
    admin.from('accounts').select('name').eq('id', params.accountId).maybeSingle(),
    proposal.client_id
      ? admin
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', proposal.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    proposal.deal_id
      ? admin
          .from('pipeline_deals')
          .select('contact_name, company_name, name')
          .eq('id', proposal.deal_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const deal = dealResult.data;
  const client =
    clientResult.data ??
    (deal
      ? {
          display_name:
            deal.contact_name?.trim() ||
            deal.company_name?.trim() ||
            deal.name?.trim() ||
            null,
          first_name: deal.contact_name?.trim()?.split(/\s+/)[0] ?? null,
          last_name:
            deal.contact_name?.trim()?.split(/\s+/).slice(1).join(' ') || null,
          company_name: deal.company_name?.trim() || null,
          email: null,
        }
      : null);

  const portalProposalUrl = new URL(
    `/portal/proposals/${proposal.public_token}`,
    siteUrl,
  ).href;

  const smartCtx = {
    client,
    proposal,
    sender: params.sender ?? null,
    accountName: account?.name ?? productName,
  };

  const subjectTemplate =
    proposal.email_subject?.trim() || DEFAULT_PROPOSAL_EMAIL_SUBJECT;
  const bodyTemplate = proposal.email_body?.trim() || DEFAULT_PROPOSAL_EMAIL_BODY;
  const signatureTemplate =
    proposal.email_signature?.trim() || DEFAULT_PROPOSAL_EMAIL_SIGNATURE;

  const subject = renderSmartFields(subjectTemplate, smartCtx);
  const bodyText = renderSmartFields(bodyTemplate, smartCtx);
  const signature = renderSmartFields(signatureTemplate, smartCtx);
  const expiresAt = proposal.expires_at
    ? new Date(proposal.expires_at).toLocaleDateString('en-GB')
    : '—';
  const amount =
    proposal.total_pence != null
      ? formatPence(proposal.total_pence, proposal.currency ?? 'gbp')
      : '—';

  const brand = await loadAccountBrandResolved(params.accountId);
  const issuedInner = `
      <h2 style="margin:0 0 16px">${subject}</h2>
      <p>${bodyText.replace(/\n/g, '<br />')}</p>
      <div style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb">
        <p style="margin:0 0 8px"><strong>${proposal.title?.trim() || 'Proposal'}</strong></p>
        <p style="margin:0 0 4px"><strong>Total:</strong> ${amount}</p>
        <p style="margin:0 0 4px"><strong>Expires:</strong> ${expiresAt}</p>
        <p style="margin:16px 0 0"><a href="${portalProposalUrl}">Review proposal</a></p>
      </div>
      <p>${signature.replace(/\n/g, '<br />')}</p>
  `;

  await sendPlatformEmail({
    type: 'proposal',
    accountId: params.accountId,
    mail: {
      from: sender,
      to: params.recipientEmail,
      subject: params.testOnly ? `[Test] ${subject}` : subject,
      html: wrapEmailHtmlWithBrand({
        brand,
        innerHtml: issuedInner,
      }),
    },
    metadata: { proposal_id: params.proposalId, event: 'issued' },
  });
}

async function loadOwnerAdminEmails(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) return [] as string[];

  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: account.slug,
  });

  return Array.from(
    new Set(
      (members ?? [])
        .filter((member: { role?: string | null; email?: string | null }) => {
          return (
            (member.role === 'owner' || member.role === 'admin') &&
            Boolean(member.email)
          );
        })
        .map((member: { email?: string | null }) => member.email!.toLowerCase()),
    ),
  ) as string[];
}

export async function sendProposalApprovedOwnerNotification(params: {
  accountId: string;
  proposalId: string;
  recipientName?: string | null;
}) {
  const sender = process.env.EMAIL_SENDER;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender) return;

  const admin = getSupabaseServerAdminClient();
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, title, recipient_name')
    .eq('id', params.proposalId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (!proposal) return;

  const ownerAdminEmails = await loadOwnerAdminEmails(params.accountId);
  if (ownerAdminEmails.length === 0) return;

  const brand = await loadAccountBrandResolved(params.accountId);
  const recipient =
    params.recipientName?.trim() ||
    proposal.recipient_name?.trim() ||
    'Your client';
  const title = proposal.title?.trim() || 'Proposal';

  const innerHtml = `
    <h2 style="margin:0 0 16px">Proposal approved</h2>
    <p><strong>${recipient}</strong> approved <strong>${title}</strong>.</p>
    <p>Open your workspace to review next steps and send the contract if needed.</p>
  `;

  for (const email of ownerAdminEmails) {
    await sendPlatformEmail({
      type: 'proposal',
      accountId: params.accountId,
      mail: {
        from: sender,
        to: email,
        subject: `${productName}: Proposal approved — ${title}`,
        html: wrapEmailHtmlWithBrand({ brand, innerHtml }),
      },
      metadata: { proposal_id: params.proposalId, event: 'approved' },
    });
  }
}

export async function sendProposalCommentOwnerNotification(params: {
  accountId: string;
  proposalId: string;
  authorName: string;
  body: string;
}) {
  const sender = process.env.EMAIL_SENDER;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender) return;

  const admin = getSupabaseServerAdminClient();
  const { data: proposal } = await admin
    .from('proposals')
    .select('id, title')
    .eq('id', params.proposalId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (!proposal) return;

  const ownerAdminEmails = await loadOwnerAdminEmails(params.accountId);
  if (ownerAdminEmails.length === 0) return;

  const brand = await loadAccountBrandResolved(params.accountId);
  const title = proposal.title?.trim() || 'Proposal';
  const innerHtml = `
    <h2 style="margin:0 0 16px">New proposal comment</h2>
    <p><strong>${params.authorName.trim()}</strong> commented on <strong>${title}</strong>:</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #FF5C34;background:#f9fafb">${params.body.trim().replace(/\n/g, '<br />')}</blockquote>
  `;

  for (const email of ownerAdminEmails) {
    await sendPlatformEmail({
      type: 'proposal',
      accountId: params.accountId,
      mail: {
        from: sender,
        to: email,
        subject: `${productName}: New comment on ${title}`,
        html: wrapEmailHtmlWithBrand({ brand, innerHtml }),
      },
      metadata: { proposal_id: params.proposalId, event: 'comment' },
    });
  }
}
