import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadAccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import pathsConfig from '~/config/paths.config';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';

import {
  DEFAULT_CONTRACT_EMAIL_BODY,
  DEFAULT_CONTRACT_EMAIL_SIGNATURE,
  DEFAULT_CONTRACT_EMAIL_SUBJECT,
  renderContractSmartFields,
} from '../contract-smart-fields';

function formatPence(pence: number, currency = 'gbp') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(pence / 100);
}

export async function sendContractIssuedEmail(params: {
  accountId: string;
  contractId: string;
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
  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .select(
      'id, account_id, client_id, title, total_pence, currency, public_token, email_subject, email_body, email_signature',
    )
    .eq('id', params.contractId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (contractError || !contract?.public_token) {
    return;
  }

  const [{ data: account }, { data: client }] = await Promise.all([
    admin
      .from('accounts')
      .select('name')
      .eq('id', params.accountId)
      .maybeSingle(),
    contract.client_id
      ? admin
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', contract.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const portalContractUrl = new URL(
    `/portal/contracts/${contract.public_token}`,
    siteUrl,
  ).href;

  const smartCtx = {
    client,
    contract,
    sender: params.sender ?? null,
    accountName: account?.name ?? productName,
  };

  const subjectTemplate =
    contract.email_subject?.trim() || DEFAULT_CONTRACT_EMAIL_SUBJECT;
  const bodyTemplate =
    contract.email_body?.trim() || DEFAULT_CONTRACT_EMAIL_BODY;
  const signatureTemplate =
    contract.email_signature?.trim() || DEFAULT_CONTRACT_EMAIL_SIGNATURE;

  const subject = renderContractSmartFields(subjectTemplate, smartCtx);
  const bodyText = renderContractSmartFields(bodyTemplate, smartCtx);
  const signature = renderContractSmartFields(signatureTemplate, smartCtx);
  const amount = formatPence(
    contract.total_pence ?? 0,
    contract.currency ?? 'gbp',
  );

  const brand = await loadAccountBrandResolved(params.accountId);
  const issuedInner = `
      <h2 style="margin:0 0 16px">${subject}</h2>
      <p>${bodyText.replace(/\n/g, '<br />')}</p>
      <div style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb">
        <p style="margin:0 0 8px"><strong>${contract.title ?? 'Agreement'}</strong></p>
        <p style="margin:0 0 4px"><strong>Total:</strong> ${amount}</p>
        <p style="margin:16px 0 0"><a href="${portalContractUrl}">Review and sign agreement</a></p>
      </div>
      <p>${signature.replace(/\n/g, '<br />')}</p>
  `;

  await sendPlatformEmail({
    type: 'contract',
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
    metadata: { contract_id: params.contractId, event: 'issued' },
  });
}

export async function sendContractSignedNotifications(params: {
  accountId: string;
  contractId: string;
}) {
  const sender = process.env.EMAIL_SENDER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender || !siteUrl) {
    return;
  }

  const admin = getSupabaseServerAdminClient();
  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .select(
      'id, account_id, client_id, title, total_pence, currency, public_token, sent_to_email, recipient_email, recipient_name',
    )
    .eq('id', params.contractId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (contractError || !contract) {
    return;
  }

  const [{ data: account }, { data: client }] = await Promise.all([
    admin
      .from('accounts')
      .select('id, name, slug')
      .eq('id', params.accountId)
      .maybeSingle(),
    contract.client_id
      ? admin
          .from('clients')
          .select('display_name, first_name, last_name, email')
          .eq('id', contract.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!account?.slug) {
    return;
  }

  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: account.slug,
  });

  const ownerAdminEmails: string[] = Array.from(
    new Set(
      (members ?? [])
        .filter((member: { role?: string | null; email?: string | null }) => {
          return (
            (member.role === 'owner' || member.role === 'admin') &&
            Boolean(member.email)
          );
        })
        .map((member: { email?: string | null }) =>
          member.email!.toLowerCase(),
        ),
    ),
  );

  const clientName =
    client?.display_name ??
    contract.recipient_name ??
    [client?.first_name, client?.last_name].filter(Boolean).join(' ') ??
    'Client';
  const clientEmail =
    client?.email ?? contract.sent_to_email ?? contract.recipient_email ?? null;
  const amount = formatPence(
    contract.total_pence ?? 0,
    contract.currency ?? 'gbp',
  );
  const portalContractUrl = contract.public_token
    ? new URL(`/portal/contracts/${contract.public_token}`, siteUrl).href
    : null;

  const brand = await loadAccountBrandResolved(params.accountId);

  const customerSubject = `Agreement signed: ${contract.title ?? 'Contract'}`;
  const customerInner = `
      <h2 style="margin:0 0 16px">Agreement signed</h2>
      <p>Hi ${clientName},</p>
      <p>Thank you for signing <strong>${contract.title ?? 'the agreement'}</strong>.</p>
      <p><strong>Total value:</strong> ${amount}</p>
      ${
        portalContractUrl
          ? `<p>You can view the signed agreement here: <a href="${portalContractUrl}">${portalContractUrl}</a></p>`
          : ''
      }
      <p>Thanks,<br />${productName}</p>
  `;
  const customerHtml = wrapEmailHtmlWithBrand({
    brand,
    innerHtml: customerInner,
  });

  const ownerSubject = `Contract signed: ${contract.title ?? 'Agreement'}`;
  const ownerInner = `
      <h2 style="margin:0 0 16px">Contract fully signed</h2>
      <p><strong>${contract.title ?? 'Agreement'}</strong> has been signed by ${clientName}.</p>
      <p><strong>Total value:</strong> ${amount}</p>
  `;
  const ownerHtml = wrapEmailHtmlWithBrand({
    brand,
    innerHtml: ownerInner,
  });

  const emailJobs: Promise<unknown>[] = [];

  if (clientEmail) {
    emailJobs.push(
      sendPlatformEmail({
        type: 'contract',
        accountId: params.accountId,
        mail: {
          from: sender,
          to: clientEmail,
          subject: customerSubject,
          html: customerHtml,
        },
        metadata: { contract_id: params.contractId, event: 'signed_customer' },
      }),
    );
  }

  for (const email of ownerAdminEmails) {
    emailJobs.push(
      sendPlatformEmail({
        type: 'contract',
        accountId: params.accountId,
        mail: {
          from: sender,
          to: email,
          subject: ownerSubject,
          html: ownerHtml,
        },
        metadata: { contract_id: params.contractId, event: 'signed_owner' },
      }),
    );
  }

  if (emailJobs.length > 0) {
    await Promise.allSettled(emailJobs);
  }

  const link = pathsConfig.app.accountContractEdit
    .replace('[account]', account.slug)
    .replace('[id]', params.contractId);

  await createInAppNotification({
    accountId: params.accountId,
    body: `${clientName} signed contract “${contract.title ?? 'Agreement'}”`,
    link,
  });
}
