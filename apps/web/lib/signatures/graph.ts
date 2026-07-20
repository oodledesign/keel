// Required: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI
/**
 * Microsoft Graph integration for the signatures module (server-only).
 *
 * Required env:
 * - AZURE_CLIENT_ID — App registration (application) client ID
 * - AZURE_CLIENT_SECRET — App registration secret (client credentials)
 * - AZURE_REDIRECT_URI — Registered redirect URI (OAuth / future user-delegated flows; not used for client_credentials token refresh)
 *
 * Graph application permissions needed for directory sync:
 * - User.Read.All (list users)
 * - ProfilePhoto.Read.All (profile photos)
 *
 * Storage: uploads use bucket `signatures-photos` (create bucket + policies in Supabase if missing).
 */
import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { type SignaturesStaffRow, renderTemplate } from './render-template';
import { buildSyncConflictMessage, findStaffByEmail } from './staff-email';
import {
  type StaffSource,
  type StaffSyncConflict,
  type StaffSyncResult,
  isManualStaffSource,
} from './staff-source';

export type { SignaturesStaffRow } from './render-template';
export { renderTemplate } from './render-template';

function getAzureCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  // Live Vercel historically used AZURE_SECRET_VALUE; prefer AZURE_CLIENT_SECRET.
  const clientSecret =
    process.env.AZURE_CLIENT_SECRET?.trim() ||
    process.env.AZURE_SECRET_VALUE?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'AZURE_CLIENT_ID and AZURE_CLIENT_SECRET (or AZURE_SECRET_VALUE) are required for Microsoft Graph',
    );
  }
  return { clientId, clientSecret };
}

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_SCOPE = 'https://graph.microsoft.com/.default';
const PHOTO_BUCKET = 'signatures-photos';

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
 * Returns a valid Graph access token for the tenant linked to this Ozer account (client_credentials).
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
      json.error_description ??
        json.error ??
        'Failed to obtain Microsoft access token',
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
): Promise<StaffSyncResult> {
  const token = await getMsAccessToken(accountId);
  const db = getSignaturesSupabaseClient();
  const admin = getSupabaseServerAdminClient();

  const errors: string[] = [];
  const conflicts: StaffSyncConflict[] = [];
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

        const existing = await findStaffByEmail(db, accountId, email);

        if (existing?.id && isManualStaffSource(existing.source as string)) {
          conflicts.push({
            email,
            existingSource: existing.source as StaffSource,
            message: buildSyncConflictMessage(
              email,
              existing.source as StaffSource,
            ),
          });
          continue;
        }

        const baseRow = {
          account_id: accountId,
          ms_user_id: u.id,
          email,
          full_name: u.displayName?.trim() ?? null,
          job_title: u.jobTitle?.trim() ?? null,
          department: u.department?.trim() ?? null,
          phone_direct: phoneDirect,
          phone_mobile: phoneMobile,
          photo_url: photoUrl,
          source: 'microsoft' as const,
        };

        if (existing?.id) {
          const photoOverridden = Boolean(existing.photo_overridden);
          const { error: updErr } = await db
            .from('staff')
            .update({
              ...baseRow,
              photo_url: photoOverridden
                ? ((existing.photo_url as string | null) ?? photoUrl)
                : photoUrl,
              branch_id: (existing.branch_id as string | null) ?? null,
              signature_email:
                (existing.signature_email as string | null) ?? null,
            })
            .eq('id', existing.id as string);

          if (updErr) {
            errors.push(`${email}: ${updErr.message}`);
          } else {
            synced += 1;
          }
        } else {
          const { error: insErr } = await db.from('staff').insert({
            ...baseRow,
            branch: null,
            signature_status: 'pending',
          });

          if (insErr) {
            errors.push(`${email}: ${insErr.message}`);
          } else {
            synced += 1;
          }
        }
      } catch (e) {
        errors.push(`${email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { synced, errors, conflicts };
}
