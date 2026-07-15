import 'server-only';

import { randomBytes } from 'node:crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getSignaturesSupabaseClient } from './graph';
import { loadSignatureRenderOptions } from './render-context';
import {
  renderTemplate,
  type SignaturesStaffRow,
} from './render-template';

export type SignaturePreviewShareRow = {
  id: string;
  account_id: string;
  template_id: string;
  staff_id: string | null;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function mintToken() {
  return randomBytes(32).toString('hex');
}

export function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '');
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export function buildSignaturePreviewPath(token: string) {
  return `/preview/signatures/${encodeURIComponent(token)}`;
}

export function buildSignaturePreviewUrl(token: string, origin?: string) {
  const base = (origin ?? getSiteOrigin()).replace(/\/$/, '');
  return `${base}${buildSignaturePreviewPath(token)}`;
}

export function createSamplePreviewStaff(
  accountId: string,
): SignaturesStaffRow {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    account_id: accountId,
    email: 'alex.morgan@example.com',
    full_name: 'Alex Morgan',
    job_title: 'Head of Client Services',
    department: 'Client Services',
    phone_direct: '+44 20 7946 0958',
    phone_mobile: '+44 7700 900123',
    branch: 'London',
    branch_id: null,
    photo_url: null,
    signature_email: null,
  };
}

/**
 * Return an existing active share for this template (+ optional staff), or create one.
 */
export async function ensureSignaturePreviewShare(input: {
  accountId: string;
  templateId: string;
  staffId?: string | null;
  createdBy?: string | null;
}): Promise<{ token: string; url: string; created: boolean }> {
  const db = getSignaturesSupabaseClient();
  const staffId = input.staffId ?? null;

  let existingQuery = db
    .from('preview_shares')
    .select('id, token')
    .eq('account_id', input.accountId)
    .eq('template_id', input.templateId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  existingQuery = staffId
    ? existingQuery.eq('staff_id', staffId)
    : existingQuery.is('staff_id', null);

  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.token) {
    return {
      token: existing.token as string,
      url: buildSignaturePreviewUrl(existing.token as string),
      created: false,
    };
  }

  const token = mintToken();
  const { data: inserted, error } = await db
    .from('preview_shares')
    .insert({
      account_id: input.accountId,
      template_id: input.templateId,
      staff_id: staffId,
      token,
      created_by: input.createdBy ?? null,
    })
    .select('token')
    .single();

  if (error || !inserted?.token) {
    throw new Error(error?.message ?? 'Could not create preview link');
  }

  return {
    token: inserted.token as string,
    url: buildSignaturePreviewUrl(inserted.token as string),
    created: true,
  };
}

export async function resolveActiveSignaturePreviewShare(token: string) {
  const trimmed = token.trim();
  if (trimmed.length < 16) {
    return null;
  }

  const db = getSignaturesSupabaseClient();
  const { data: share, error } = await db
    .from('preview_shares')
    .select(
      'id, account_id, template_id, staff_id, token, expires_at, revoked_at, created_at',
    )
    .eq('token', trimmed)
    .maybeSingle();

  if (error || !share) {
    return null;
  }

  if (share.revoked_at) {
    return null;
  }

  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return share as SignaturePreviewShareRow;
}

export type PublicSignaturePreview = {
  templateName: string;
  accountName: string | null;
  fromName: string;
  fromEmail: string;
  signatureHtml: string;
  /** True when the share is pinned to a real staff member (install-ready). */
  isPersonalShare: boolean;
};

export async function loadPublicSignaturePreview(
  token: string,
): Promise<PublicSignaturePreview | null> {
  const share = await resolveActiveSignaturePreviewShare(token);
  if (!share) {
    return null;
  }

  const db = getSignaturesSupabaseClient();
  const admin = getSupabaseServerAdminClient();

  const [{ data: template }, { data: staff }, { data: account }] =
    await Promise.all([
      db
        .from('templates')
        .select('id, name, html_template, account_id')
        .eq('id', share.template_id)
        .eq('account_id', share.account_id)
        .maybeSingle(),
      share.staff_id
        ? db
            .from('staff')
            .select('*')
            .eq('id', share.staff_id)
            .eq('account_id', share.account_id)
            .maybeSingle()
        : Promise.resolve({ data: null as SignaturesStaffRow | null }),
      admin
        .from('accounts')
        .select('name')
        .eq('id', share.account_id)
        .maybeSingle(),
    ]);

  if (!template?.html_template) {
    return null;
  }

  const staffRow =
    (staff as SignaturesStaffRow | null) ??
    createSamplePreviewStaff(share.account_id);

  const renderOptions = await loadSignatureRenderOptions(
    share.account_id,
    staffRow,
  );
  const signatureHtml = renderTemplate(
    template.html_template as string,
    staffRow,
    renderOptions,
  );

  return {
    templateName: String(template.name ?? 'Signature'),
    accountName: (account?.name as string | null | undefined)?.trim() || null,
    fromName: staffRow.full_name?.trim() || 'Alex Morgan',
    fromEmail: staffRow.signature_email?.trim() || staffRow.email,
    signatureHtml,
    isPersonalShare: Boolean(share.staff_id && staff),
  };
}
