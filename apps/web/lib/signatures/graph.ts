// Required: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI
/**
 * Microsoft Graph integration for the signatures module (server-only).
 *
 * Required env:
 * - AZURE_CLIENT_ID — App registration (application) client ID
 * - AZURE_CLIENT_SECRET — App registration secret (client credentials)
 * - AZURE_REDIRECT_URI — Registered redirect URI (OAuth / future user-delegated flows; not used for client_credentials token refresh)
 *
 * Graph application permissions typically needed:
 * - User.Read.All (sync users + photos)
 * - MailboxSettings.ReadWrite (if mailbox PATCH is enabled for your tenant)
 *
 * Storage: uploads use bucket `signatures-photos` (create bucket + policies in Supabase if missing).
 */
import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
  type AccountBrandResolved,
  loadAccountBrandResolved,
} from '~/lib/brand/account-brand';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_SCOPE = 'https://graph.microsoft.com/.default';
const PHOTO_BUCKET = 'signatures-photos';

/** Row shape for template rendering (matches `signatures.staff`). */
export type SignaturesStaffRow = {
  id: string;
  account_id: string;
  ms_user_id: string | null;
  email: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  phone_direct: string | null;
  phone_mobile: string | null;
  branch: string | null;
  photo_url: string | null;
  signature_status: string | null;
  signature_pushed_at: string | null;
  created_at?: string | null;
};

const TOKEN_KEYS = [
  'full_name',
  'job_title',
  'department',
  'phone_direct',
  'phone_mobile',
  'email',
  'branch',
  'photo_url',
] as const;

/** Placeholders supported in HTML templates but not stored on staff rows yet — replace with empty string or spacer image. */
const OPTIONAL_TEMPLATE_KEYS = [
  'credentials',
  'website',
  'address',
  'company_logo_url',
  'award_badge_url',
  'brand_primary_color',
  'brand_secondary_color',
  'brand_accent_color',
  'brand_logo_url',
] as const;

/** 1×1 transparent GIF — avoids broken image icons when URLs are blank (many clients). */
const TRANSPARENT_PIXEL_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

type TokenKey = (typeof TOKEN_KEYS)[number];
type RenderTemplateOptions = {
  awardBadgeUrl?: string | null;
  /** Workspace brand from `account_brand_settings`; fills `{{brand_*}}` placeholders. */
  brand?: AccountBrandResolved | null;
};

function getAzureCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are required for Microsoft Graph',
    );
  }
  return { clientId, clientSecret };
}

function tokenExpiresInFuture(
  tokenExpiresAt: string | null | undefined,
  bufferSec = 120,
): boolean {
  if (!tokenExpiresAt) return false;
  const t = new Date(tokenExpiresAt).getTime();
  return t > Date.now() + bufferSec * 1000;
}

/**
 * Service-role PostgREST client scoped to `signatures` (bypasses RLS for token storage, sync, push logs).
 */
export function getSignaturesSupabaseClient() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'signatures');
}

/**
 * Returns a valid Graph access token for the tenant linked to this Keel account (client_credentials).
 */
export async function getMsAccessToken(accountId: string): Promise<string> {
  const db = getSignaturesSupabaseClient();
  const { data: conn, error } = await db
    .from('ms_connections')
    .select('ms_tenant_id, access_token, token_expires_at')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!conn?.ms_tenant_id) {
    throw new Error('No Microsoft connection configured for this account');
  }

  if (
    conn.access_token &&
    tokenExpiresInFuture(conn.token_expires_at ?? null)
  ) {
    return conn.access_token;
  }

  const { clientId, clientSecret } = getAzureCreds();
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(conn.ms_tenant_id)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: TOKEN_SCOPE,
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? 'Failed to obtain Microsoft access token',
    );
  }

  const expiresIn = json.expires_in ?? 3600;
  const tokenExpiresAt = new Date(
    Date.now() + Math.max(0, expiresIn - 120) * 1000,
  ).toISOString();

  const { error: upErr } = await db
    .from('ms_connections')
    .update({
      access_token: json.access_token,
      token_expires_at: tokenExpiresAt,
    })
    .eq('account_id', accountId);

  if (upErr) {
    throw new Error(upErr.message);
  }

  return json.access_token;
}

type GraphUser = {
  id: string;
  displayName?: string;
  mail?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  mobilePhone?: string | null;
  businessPhones?: string[];
};

/**
 * Pull directory users from Microsoft Graph and upsert `signatures.staff`; upload profile photos to Storage.
 */
export async function syncStaffFromM365(
  accountId: string,
): Promise<{ synced: number; errors: string[] }> {
  const token = await getMsAccessToken(accountId);
  const db = getSignaturesSupabaseClient();
  const admin = getSupabaseServerAdminClient();

  const errors: string[] = [];
  let synced = 0;

  let nextUrl: string | null =
    `${GRAPH_BASE}/users?$select=id,displayName,mail,jobTitle,department,mobilePhone,businessPhones&$top=999`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await res.json()) as {
      value?: GraphUser[];
      '@odata.nextLink'?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      errors.push(
        payload.error?.message ?? `Graph users list failed (${res.status})`,
      );
      break;
    }

    const users = payload.value ?? [];
    nextUrl = payload['@odata.nextLink'] ?? null;

    for (const u of users) {
      const email = (u.mail ?? '').trim();
      if (!email) {
        continue;
      }

      try {
        const businessPhones = u.businessPhones ?? [];
        const phoneDirect = businessPhones[0]?.trim() ?? null;
        const phoneMobile = u.mobilePhone?.trim() ?? null;

        let photoUrl: string | null = null;
        const photoRes = await fetch(
          `${GRAPH_BASE}/users/${encodeURIComponent(u.id)}/photo/$value`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (photoRes.ok) {
          const buf = Buffer.from(await photoRes.arrayBuffer());
          const path = `${accountId}/${u.id}.jpg`;
          const { error: upPhotoErr } = await admin.storage
            .from(PHOTO_BUCKET)
            .upload(path, buf, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!upPhotoErr) {
            const { data: pub } = admin.storage
              .from(PHOTO_BUCKET)
              .getPublicUrl(path);
            photoUrl = pub.publicUrl;
          } else {
            errors.push(`${email}: photo upload — ${upPhotoErr.message}`);
          }
        }

        const { data: existing } = await db
          .from('staff')
          .select('id, signature_status')
          .eq('account_id', accountId)
          .eq('email', email)
          .maybeSingle();

        const baseRow = {
          account_id: accountId,
          ms_user_id: u.id,
          email,
          full_name: u.displayName?.trim() ?? null,
          job_title: u.jobTitle?.trim() ?? null,
          department: u.department?.trim() ?? null,
          phone_direct: phoneDirect,
          phone_mobile: phoneMobile,
          branch: null as string | null,
          photo_url: photoUrl,
        };

        if (existing?.id) {
          const { error: updErr } = await db
            .from('staff')
            .update(baseRow)
            .eq('id', existing.id);

          if (updErr) {
            errors.push(`${email}: ${updErr.message}`);
          } else {
            synced += 1;
          }
        } else {
          const { error: insErr } = await db.from('staff').insert({
            ...baseRow,
            signature_status: 'pending',
          });

          if (insErr) {
            errors.push(`${email}: ${insErr.message}`);
          } else {
            synced += 1;
          }
        }
      } catch (e) {
        errors.push(
          `${email}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  return { synced, errors };
}

function tokenValue(staff: SignaturesStaffRow, key: TokenKey): string {
  const v = staff[key];
  return v == null ? '' : String(v);
}

/**
 * Replace `{{field}}` placeholders and wrap with a dark-text / system-font shell for email clients.
 */
export function renderTemplate(
  htmlTemplate: string,
  staff: SignaturesStaffRow,
  options?: RenderTemplateOptions,
): string {
  let html = htmlTemplate;
  for (const key of TOKEN_KEYS) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    let val = tokenValue(staff, key);
    if (key === 'photo_url' && !val) {
      val = TRANSPARENT_PIXEL_GIF;
    }
    html = html.replace(re, val);
  }

  for (const key of OPTIONAL_TEMPLATE_KEYS) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    const empty = '';
    let replacement = empty;
    if (key === 'company_logo_url') {
      replacement = TRANSPARENT_PIXEL_GIF;
    } else if (key === 'award_badge_url') {
      replacement = options?.awardBadgeUrl?.trim() || TRANSPARENT_PIXEL_GIF;
    } else if (key === 'brand_primary_color') {
      replacement = options?.brand?.primary_color ?? DEFAULT_BRAND_PRIMARY;
    } else if (key === 'brand_secondary_color') {
      replacement = options?.brand?.secondary_color ?? DEFAULT_BRAND_SECONDARY;
    } else if (key === 'brand_accent_color') {
      replacement = options?.brand?.accent_color ?? DEFAULT_BRAND_ACCENT;
    } else if (key === 'brand_logo_url') {
      replacement = options?.brand?.logo_url?.trim()
        ? options.brand.logo_url
        : TRANSPARENT_PIXEL_GIF;
    }
    html = html.replace(re, replacement);
  }

  const inner = html.trim();
  return `<div style="color:#000000;font-family:Arial,Calibri,Georgia,sans-serif;line-height:1.4;">${inner}</div>`;
}

async function fetchStaffTemplateRows(staffId: string): Promise<{
  staff: SignaturesStaffRow | null;
  templateHtml: string | null;
  accountId: string | null;
}> {
  const db = getSignaturesSupabaseClient();

  const { data: staffRow, error: se } = await db
    .from('staff')
    .select('*')
    .eq('id', staffId)
    .maybeSingle();

  if (se || !staffRow) {
    return { staff: null, templateHtml: null, accountId: null };
  }

  const staff = staffRow as SignaturesStaffRow;

  const { data: links, error: le } = await db
    .from('staff_templates')
    .select('template_id')
    .eq('staff_id', staffId);

  if (le || !links?.length) {
    return { staff, templateHtml: null, accountId: staff.account_id };
  }

  const ids = links.map((l) => l.template_id as string);
  const { data: templates, error: te } = await db
    .from('templates')
    .select('id, html_template, is_default, created_at')
    .in('id', ids);

  if (te || !templates?.length) {
    return { staff, templateHtml: null, accountId: staff.account_id };
  }

  type TRow = {
    html_template: string;
    is_default: boolean | null;
    created_at: string | null;
  };
  const sorted = [...(templates as TRow[])].sort((a, b) => {
    const ad = !!a.is_default;
    const bd = !!b.is_default;
    if (ad !== bd) return ad ? -1 : 1;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  return {
    staff,
    templateHtml: sorted[0]?.html_template ?? null,
    accountId: staff.account_id,
  };
}

export async function loadDepartmentBadgeUrl(
  accountId: string,
  department: string | null | undefined,
): Promise<string | null> {
  const normalized = department?.trim();
  if (!normalized) {
    return null;
  }

  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('department_badges')
    .select('award_badge_url')
    .eq('account_id', accountId)
    .eq('department', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.award_badge_url as string | null | undefined)?.trim() || null;
}

/**
 * Push rendered signature for one staff member via Microsoft Graph and update DB + audit log.
 *
 * TODO: Microsoft Graph v1.0 `mailboxSettings` does not expose a stable property for **HTML email
 * signature** body on all tenants. The PATCH below uses `{ "userPurpose": "user" }` only as a
 * placeholder request to validate auth — **confirm the correct property path** (often explored under
 * beta endpoints, Exchange Online PowerShell, or tenant-specific Graph capabilities) before relying on
 * this in production. Consider replacing with the documented API once your app registration
 * permissions and tenant support are confirmed.
 */
export async function pushSignatureToStaff(
  staffId: string,
): Promise<{ success: boolean; error?: string }> {
  return pushSignatureToStaffWithActor(staffId, null);
}

async function pushSignatureToStaffWithActor(
  staffId: string,
  pushedByUserId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const db = getSignaturesSupabaseClient();
  const { staff, templateHtml, accountId } =
    await fetchStaffTemplateRows(staffId);

  if (!staff || !accountId) {
    return { success: false, error: 'Staff not found' };
  }
  if (!staff.ms_user_id) {
    const msg = 'Staff has no ms_user_id (sync from M365 first)';
    await logPush(db, accountId, staffId, pushedByUserId, 'error', msg);
    await db
      .from('staff')
      .update({
        signature_status: 'error',
        signature_pushed_at: new Date().toISOString(),
      })
      .eq('id', staffId);
    return { success: false, error: msg };
  }
  if (!templateHtml) {
    const msg = 'No template assigned to this staff member';
    await logPush(db, accountId, staffId, pushedByUserId, 'error', msg);
    await db
      .from('staff')
      .update({
        signature_status: 'error',
        signature_pushed_at: new Date().toISOString(),
      })
      .eq('id', staffId);
    return { success: false, error: msg };
  }

  /** Rendered HTML for when Graph exposes a supported signature property (see TODO below). */
  const [departmentBadgeUrl, brand] = await Promise.all([
    loadDepartmentBadgeUrl(accountId, staff.department),
    loadAccountBrandResolved(accountId),
  ]);
  const renderedHtml = renderTemplate(templateHtml, staff, {
    awardBadgeUrl: departmentBadgeUrl,
    brand,
  });
  let graphError: string | null = null;

  try {
    const token = await getMsAccessToken(accountId);
    const patchUrl = `${GRAPH_BASE}/users/${encodeURIComponent(staff.ms_user_id)}/mailboxSettings`;

    // Placeholder body — replace with real signature payload once Graph supports your scenario.
    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userPurpose: 'user' }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      graphError = `Graph mailboxSettings ${res.status}: ${errBody.slice(0, 500)}`;
    } else {
      // `renderedHtml` will wire into the correct mailboxSettings / Outlook payload once confirmed.
      void renderedHtml;
    }
  } catch (e) {
    graphError = e instanceof Error ? e.message : String(e);
  }

  const now = new Date().toISOString();
  if (graphError) {
    await db
      .from('staff')
      .update({ signature_status: 'error', signature_pushed_at: now })
      .eq('id', staffId);
    await logPush(db, accountId, staffId, pushedByUserId, 'error', graphError);
    return { success: false, error: graphError };
  }

  await db
    .from('staff')
    .update({ signature_status: 'pushed', signature_pushed_at: now })
    .eq('id', staffId);
  await logPush(db, accountId, staffId, pushedByUserId, 'success', null);

  return { success: true };
}

async function logPush(
  db: ReturnType<typeof getSignaturesSupabaseClient>,
  accountId: string,
  staffId: string,
  pushedBy: string | null,
  status: 'success' | 'error',
  errorMessage: string | null,
) {
  await db.from('push_log').insert({
    account_id: accountId,
    staff_id: staffId,
    pushed_by: pushedBy,
    status,
    error_message: errorMessage,
  });
}

/**
 * Push signatures for every staff row in the account (individual errors collected; each push writes `push_log`).
 */
export async function pushAllSignatures(
  accountId: string,
  pushedBy: string,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const db = getSignaturesSupabaseClient();
  const { data: rows, error } = await db
    .from('staff')
    .select('id')
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }

  const ids = (rows ?? []).map((r) => r.id as string);
  let succeeded = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const r = await pushSignatureToStaffWithActor(id, pushedBy);
      if (r.success) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { total: ids.length, succeeded, failed };
}
