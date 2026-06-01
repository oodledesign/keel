import 'server-only';

import { createSign, createPrivateKey } from 'node:crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadAccountBrandResolved,
  type AccountBrandResolved,
} from '~/lib/brand/account-brand';

import { getSignaturesSupabaseClient } from './graph';
import {
  isMissingRelationError,
  logMissingRelation,
} from '~/home/[account]/_lib/server/supabase-errors';
import {
  renderTemplate,
  type SignaturesStaffRow,
} from './render-template';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DIRECTORY_BASE = 'https://admin.googleapis.com/admin/directory/v1';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1';
const PHOTO_BUCKET = 'signatures-photos';

const DIRECTORY_SCOPE =
  'https://www.googleapis.com/auth/admin.directory.user.readonly';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.settings.basic';

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

export type GoogleConnection = {
  id: string;
  account_id: string;
  primary_domain: string;
  delegated_admin_email: string;
  connected_at: string;
  connected_by: string | null;
};

function parseServiceAccountCredentials(): ServiceAccountCredentials {
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw) as Partial<ServiceAccountCredentials>;
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, '\n'),
      };
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n',
  );

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google service account is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.',
    );
  }

  return { client_email: clientEmail, private_key: privateKey };
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

async function getGoogleAccessToken(
  subject: string,
  scopes: string[],
): Promise<string> {
  const creds = parseServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: creds.client_email,
      sub: subject,
      scope: scopes.join(' '),
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();

  const signature = signer.sign(
    createPrivateKey(creds.private_key),
    'base64url',
  );
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const json = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ??
        json.error ??
        'Failed to obtain Google access token',
    );
  }

  return json.access_token;
}

export async function loadGoogleConnection(
  accountId: string,
): Promise<GoogleConnection | null> {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('google_connections')
    .select(
      'id, account_id, primary_domain, delegated_admin_email, connected_at, connected_by',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      logMissingRelation('signatures.loadGoogleConnection', error);
      return null;
    }
    throw new Error(error.message);
  }

  return (data ?? null) as GoogleConnection | null;
}

/** Verify domain-wide delegation by listing one user from the Workspace directory. */
export async function testGoogleWorkspaceConnection(input: {
  primaryDomain: string;
  delegatedAdminEmail: string;
}): Promise<{ ok: true; sampleEmail: string | null }> {
  const domain = input.primaryDomain.trim().toLowerCase();
  const adminEmail = input.delegatedAdminEmail.trim().toLowerCase();

  if (!domain.includes('.')) {
    throw new Error('Enter a valid primary domain (e.g. example.com)');
  }
  if (!adminEmail.includes('@')) {
    throw new Error('Enter a valid delegated admin email');
  }
  if (!adminEmail.endsWith(`@${domain}`)) {
    throw new Error(
      `Delegated admin email must belong to ${domain}`,
    );
  }

  const token = await getGoogleAccessToken(adminEmail, [DIRECTORY_SCOPE]);
  const url = `${DIRECTORY_BASE}/users?domain=${encodeURIComponent(domain)}&maxResults=1&orderBy=email&projection=full`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    users?: Array<{ primaryEmail?: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      json.error?.message ??
        `Google Directory API failed (${res.status}). Confirm domain-wide delegation and Admin SDK API are enabled.`,
    );
  }

  return {
    ok: true,
    sampleEmail: json.users?.[0]?.primaryEmail ?? null,
  };
}

export async function connectGoogleWorkspace(input: {
  accountId: string;
  primaryDomain: string;
  delegatedAdminEmail: string;
  connectedBy: string;
}): Promise<GoogleConnection> {
  await testGoogleWorkspaceConnection({
    primaryDomain: input.primaryDomain,
    delegatedAdminEmail: input.delegatedAdminEmail,
  });

  const db = getSignaturesSupabaseClient();
  const row = {
    account_id: input.accountId,
    primary_domain: input.primaryDomain.trim().toLowerCase(),
    delegated_admin_email: input.delegatedAdminEmail.trim().toLowerCase(),
    connected_by: input.connectedBy,
  };

  const { data, error } = await db
    .from('google_connections')
    .upsert(row, { onConflict: 'account_id' })
    .select(
      'id, account_id, primary_domain, delegated_admin_email, connected_at, connected_by',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save Google connection');
  }

  return data as GoogleConnection;
}

export async function disconnectGoogleWorkspace(accountId: string): Promise<void> {
  const db = getSignaturesSupabaseClient();
  const { error } = await db
    .from('google_connections')
    .delete()
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }
}

type DirectoryUser = {
  id?: string;
  primaryEmail?: string;
  name?: { fullName?: string };
  organizations?: Array<{ title?: string; department?: string; primary?: boolean }>;
  phones?: Array<{ value?: string; type?: string }>;
  thumbnailPhotoUrl?: string;
};

function pickOrganization(user: DirectoryUser) {
  const orgs = user.organizations ?? [];
  return orgs.find((org) => org.primary) ?? orgs[0] ?? null;
}

function pickPhone(user: DirectoryUser, type: string): string | null {
  const phone = (user.phones ?? []).find(
    (entry) => entry.type?.toLowerCase() === type,
  );
  return phone?.value?.trim() ?? null;
}

export async function syncStaffFromGoogleWorkspace(
  accountId: string,
): Promise<{ synced: number; errors: string[] }> {
  const connection = await loadGoogleConnection(accountId);
  if (!connection) {
    throw new Error('No Google Workspace connection configured for this account');
  }

  const token = await getGoogleAccessToken(connection.delegated_admin_email, [
    DIRECTORY_SCOPE,
  ]);
  const db = getSignaturesSupabaseClient();
  const admin = getSupabaseServerAdminClient();

  const errors: string[] = [];
  let synced = 0;
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      domain: connection.primary_domain,
      maxResults: '500',
      orderBy: 'email',
      projection: 'full',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const res = await fetch(`${DIRECTORY_BASE}/users?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await res.json()) as {
      users?: DirectoryUser[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      errors.push(
        payload.error?.message ??
          `Google Directory users list failed (${res.status})`,
      );
      break;
    }

    for (const user of payload.users ?? []) {
      const email = user.primaryEmail?.trim().toLowerCase();
      if (!email || !user.id) {
        continue;
      }

      try {
        const org = pickOrganization(user);
        let photoUrl: string | null = null;

        if (user.thumbnailPhotoUrl) {
          const photoRes = await fetch(user.thumbnailPhotoUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (photoRes.ok) {
            const buf = Buffer.from(await photoRes.arrayBuffer());
            const path = `${accountId}/google-${user.id}.jpg`;
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
            }
          }
        }

        const baseRow = {
          account_id: accountId,
          google_user_id: user.id,
          ms_user_id: null,
          email,
          full_name: user.name?.fullName?.trim() ?? null,
          job_title: org?.title?.trim() ?? null,
          department: org?.department?.trim() ?? null,
          phone_direct: pickPhone(user, 'work'),
          phone_mobile: pickPhone(user, 'mobile'),
          branch: null as string | null,
          photo_url: photoUrl,
        };

        const { data: existing } = await db
          .from('staff')
          .select('id')
          .eq('account_id', accountId)
          .eq('email', email)
          .maybeSingle();

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
        errors.push(`${email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    pageToken = payload.nextPageToken;
  } while (pageToken);

  return { synced, errors };
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

async function loadDepartmentBadgeUrl(
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

export async function pushSignatureToGoogleStaff(
  staffId: string,
  pushedByUserId: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  const db = getSignaturesSupabaseClient();
  const { staff, templateHtml, accountId } =
    await fetchStaffTemplateRows(staffId);

  if (!staff || !accountId) {
    return { success: false, error: 'Staff not found' };
  }

  const connection = await loadGoogleConnection(accountId);
  if (!connection) {
    return { success: false, error: 'No Google Workspace connection configured' };
  }

  if (!staff.email) {
    const msg = 'Staff has no email address';
    await logPush(db, accountId, staffId, pushedByUserId, 'error', msg);
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

  const [departmentBadgeUrl, brand] = await Promise.all([
    loadDepartmentBadgeUrl(accountId, staff.department),
    loadAccountBrandResolved(accountId),
  ]);
  const renderedHtml = renderTemplate(templateHtml, staff, {
    awardBadgeUrl: departmentBadgeUrl,
    brand: brand as AccountBrandResolved,
  });

  let graphError: string | null = null;

  try {
    const token = await getGoogleAccessToken(staff.email, [GMAIL_SCOPE]);
    const userPath = encodeURIComponent(staff.email);

    const listRes = await fetch(
      `${GMAIL_BASE}/users/${userPath}/settings/sendAs`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const listJson = (await listRes.json()) as {
      sendAs?: Array<{ sendAsEmail?: string; isPrimary?: boolean }>;
      error?: { message?: string };
    };

    if (!listRes.ok) {
      throw new Error(
        listJson.error?.message ??
          `Gmail sendAs list failed (${listRes.status})`,
      );
    }

    const sendAs =
      listJson.sendAs?.find((entry) => entry.isPrimary) ??
      listJson.sendAs?.find(
        (entry) =>
          entry.sendAsEmail?.toLowerCase() === staff.email.toLowerCase(),
      ) ??
      listJson.sendAs?.[0];

    if (!sendAs?.sendAsEmail) {
      throw new Error('No Gmail send-as address found for this user');
    }

    const patchRes = await fetch(
      `${GMAIL_BASE}/users/${userPath}/settings/sendAs/${encodeURIComponent(sendAs.sendAsEmail)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature: renderedHtml }),
      },
    );

    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      graphError = `Gmail signature update ${patchRes.status}: ${errBody.slice(0, 500)}`;
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
