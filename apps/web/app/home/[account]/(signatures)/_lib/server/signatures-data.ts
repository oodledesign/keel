import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '~/home/[account]/_lib/server/workspace-route-guard';
import { getSignaturesSupabaseClient } from '~/lib/signatures/graph';
import {
  createMinimalSignatureDocument,
  signatureBlocksToHtml,
} from '~/lib/signatures/signature-blocks';
import type { StaffSource } from '~/lib/signatures/staff-source';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

/** Simple two-column layout — kept for reference / migration copy-paste.
 * Dark-mode friendly: mid-grey text, underlined links, no solid canvas. */
export const MINIMAL_SIGNATURE_TEMPLATE = `<!-- Ozer Signatures minimal template (dark-mode resilient) -->
<table cellpadding="0" cellspacing="0" role="presentation" style="font-family:Arial,sans-serif;color:#333333;border-collapse:collapse;">
  <tr>
    <td style="padding-right:16px;vertical-align:top;">
      <img src="{{photo_url}}" width="80" height="80" alt="{{full_name}}" style="display:block;width:80px;height:80px;border-radius:999px;object-fit:cover;" />
    </td>
    <td style="vertical-align:top;color:#333333;">
      <div style="font-size:18px;font-weight:700;line-height:1.25;color:#333333;">{{full_name}}</div>
      <div style="font-size:14px;line-height:1.4;color:#555555;">{{job_title}}</div>
      <div style="font-size:13px;margin-top:8px;line-height:1.5;color:#333333;">
        <div>{{phone_direct}}</div>
        <div>{{phone_mobile}}</div>
        <div><a href="mailto:{{email}}" style="color:#333333;text-decoration:underline;">{{email}}</a></div>
      </div>
    </td>
  </tr>
</table>`;

/**
 * Executive banner — portrait left, brand-coloured panel right (email-safe tables + inline CSS).
 * Workspace brand: {{brand_primary_color}}, {{brand_secondary_color}}, {{brand_accent_color}}, {{brand_logo_url}} (Settings → Brand).
 * Company contact: {{website}} (Settings → Brand), {{address}} (branch or brand fallback).
 * Placeholders: {{photo_url}}, {{full_name}}, {{credentials}}, {{job_title}}, {{email}},
 * {{award_badge_url}}, plus {{phone_direct}}, {{phone_mobile}}, {{department}}, {{branch}}.
 * Phone, email, and address use the staff member's branch (Settings → Brand → Branches) when not overridden on their profile.
 */
export const DEFAULT_SIGNATURE_TEMPLATE = `<!-- Ozer Signatures — executive banner (Outlook-safe table layout) -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;max-width:560px;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td style="width:160px;vertical-align:top;padding:0;line-height:0;font-size:0;">
      <img src="{{photo_url}}" alt="{{full_name}}" width="160" height="200" style="display:block;width:160px;height:200px;object-fit:cover;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
    </td>
    <td style="vertical-align:top;background-color:{{brand_primary_color}};color:#FFFFFF;padding:20px 22px 18px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;padding:0 12px 0 0;">
            <div style="font-size:20px;font-weight:700;line-height:1.2;color:#FFFFFF;">
              {{full_name}}<span style="font-size:14px;font-weight:400;"> {{credentials}}</span>
            </div>
            <div style="font-size:15px;font-weight:400;line-height:1.35;margin-top:8px;color:#FFFFFF;">
              {{job_title}}
            </div>
          </td>
          <td style="vertical-align:top;text-align:right;width:132px;padding:0;line-height:0;">
            <img src="{{brand_logo_url}}" alt="" width="120" style="display:block;max-width:120px;height:auto;margin-left:auto;border:0;" />
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:16px;">
        <tr>
          <td style="padding:0 10px 6px 0;vertical-align:top;color:#B8D5E8;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;width:72px;">Email</td>
          <td style="padding:0 0 6px 0;vertical-align:top;font-size:13px;line-height:1.5;">
            <a href="mailto:{{email}}" style="color:#FFFFFF;text-decoration:none;">{{email}}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 10px 6px 0;vertical-align:top;color:#B8D5E8;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;width:72px;">Web</td>
          <td style="padding:0 0 6px 0;vertical-align:top;font-size:13px;line-height:1.5;color:#FFFFFF;">{{website}}</td>
        </tr>
        <tr>
          <td style="padding:0 10px 0 0;vertical-align:top;color:#B8D5E8;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;width:72px;">Address</td>
          <td style="padding:0;vertical-align:top;font-size:13px;line-height:1.5;color:#FFFFFF;">{{address}}</td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:12px;">
        <tr>
          <td style="text-align:right;padding:0;vertical-align:bottom;line-height:0;">
            {{award_badges}}
          </td>
        </tr>
      </table>
      <div style="font-size:12px;line-height:1.45;margin-top:14px;color:#D4DFEA;">
        {{phone_direct}}<br />{{phone_mobile}}
      </div>
    </td>
  </tr>
</table>`;

/** Built-in layouts for a future “choose starter template” flow; custom HTML always allowed. */
export const SIGNATURE_TEMPLATE_PRESETS = [
  {
    id: 'executive',
    name: 'Executive banner',
    html: DEFAULT_SIGNATURE_TEMPLATE,
  },
  { id: 'minimal', name: 'Minimal', html: MINIMAL_SIGNATURE_TEMPLATE },
] as const;

export type SignatureStatus = 'pending' | 'pushed' | 'error';

export type SignatureStaff = {
  id: string;
  account_id: string;
  ms_user_id: string | null;
  google_user_id: string | null;
  source: StaffSource;
  email: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  phone_direct: string | null;
  phone_mobile: string | null;
  branch: string | null;
  branch_id: string | null;
  branch_name?: string | null;
  signature_email: string | null;
  photo_url: string | null;
  signature_status: SignatureStatus;
  signature_pushed_at: string | null;
  created_at: string | null;
  template_id: string | null;
  template_name: string | null;
};

export type SignatureTemplate = {
  id: string;
  account_id: string;
  name: string;
  html_template: string;
  is_default: boolean;
  preview_image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MsConnection = {
  id: string;
  account_id: string;
  ms_tenant_id: string;
  connected_at: string;
  connected_by: string | null;
};

export type GoogleConnection = {
  id: string;
  account_id: string;
  primary_domain: string;
  delegated_admin_email: string;
  connected_at: string;
  connected_by: string | null;
};

export { loadGoogleConnection } from '~/lib/signatures/google-workspace';
export {
  getSignaturesMailProvider,
  isSignaturesMailConnected,
  type SignaturesMailProvider,
} from '~/lib/signatures/signatures-provider';

export type SignatureDepartmentBadge = {
  account_id: string;
  department: string;
  award_badge_url: string;
  created_at: string | null;
  updated_at: string | null;
};

export { isSignaturesPostgrestSchemaError } from '../signatures-postgrest-schema-error';

function publicClient() {
  return getSupabaseServerClient() as SupabaseClient;
}

function signaturesClient(client = publicClient()) {
  return supabaseCustomSchema(client, 'signatures') as any;
}

export async function loadSignaturesWorkspace(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  return workspace;
}

export async function loadMsConnection(accountId: string) {
  const { data, error } = await signaturesClient()
    .from('ms_connections')
    .select('id, account_id, ms_tenant_id, connected_at, connected_by')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as MsConnection | null;
}

export async function loadTemplates(accountId: string) {
  const { data, error } = await signaturesClient()
    .from('templates')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SignatureTemplate[];
}

export async function loadDepartmentBadges(accountId: string) {
  const { data, error } = await signaturesClient()
    .from('department_badges')
    .select('account_id, department, award_badge_url, created_at, updated_at')
    .eq('account_id', accountId)
    .order('department', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SignatureDepartmentBadge[];
}

export async function loadDepartments(accountId: string) {
  const { data, error } = await signaturesClient()
    .from('staff')
    .select('department')
    .eq('account_id', accountId)
    .not('department', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  return [
    ...new Set((data ?? []).map((row: any) => String(row.department).trim())),
  ]
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b));
}

export async function loadStaffRows(
  accountId: string,
  filters?: {
    branch?: string | null;
    department?: string | null;
    status?: string | null;
  },
) {
  let query = signaturesClient()
    .from('staff')
    .select('*')
    .eq('account_id', accountId)
    .order('full_name', { ascending: true });

  if (filters?.branch) {
    query = query.eq('branch_id', filters.branch);
  }
  if (filters?.department) {
    query = query.eq('department', filters.department);
  }
  if (filters?.status) {
    query = query.eq('signature_status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const { loadAccountBranches } = await import('~/lib/brand/account-branches');
  const branches = await loadAccountBranches(accountId);
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const rows = ((data ?? []) as SignatureStaff[]).map((row) => ({
    ...row,
    branch_name: row.branch_id
      ? (branchNameById.get(row.branch_id) ?? null)
      : null,
    branch: row.branch_id
      ? (branchNameById.get(row.branch_id) ?? row.branch)
      : row.branch,
  }));

  return decorateStaffWithTemplates(rows);
}

async function decorateStaffWithTemplates(rows: SignatureStaff[]) {
  if (!rows.length) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const { data: links, error: linksError } = await signaturesClient()
    .from('staff_templates')
    .select('staff_id, template_id')
    .in('staff_id', ids);

  if (linksError) {
    throw new Error(linksError.message);
  }

  const templateIds = [
    ...new Set((links ?? []).map((link: any) => link.template_id as string)),
  ];

  const templateMap = new Map<string, SignatureTemplate>();
  if (templateIds.length) {
    const { data: templates, error: templateError } = await signaturesClient()
      .from('templates')
      .select('*')
      .in('id', templateIds);

    if (templateError) {
      throw new Error(templateError.message);
    }

    for (const template of (templates ?? []) as SignatureTemplate[]) {
      templateMap.set(template.id, template);
    }
  }

  const linkByStaff = new Map<string, string>();
  for (const link of links ?? []) {
    linkByStaff.set(link.staff_id as string, link.template_id as string);
  }

  return rows.map((row) => {
    const templateId = linkByStaff.get(row.id) ?? null;
    const template = templateId ? templateMap.get(templateId) : null;
    return {
      ...row,
      template_id: templateId,
      template_name: template?.name ?? null,
    };
  });
}

export async function loadSignaturesDashboard(accountId: string) {
  const staff = await loadStaffRows(accountId);
  const summary = staff.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.signature_status === 'pushed') acc.pushed += 1;
      if (row.signature_status === 'pending') acc.pending += 1;
      if (row.signature_status === 'error') acc.errors += 1;
      return acc;
    },
    { total: 0, pushed: 0, pending: 0, errors: 0 },
  );

  return { summary, staff };
}

export async function loadStaffDetail(accountId: string, staffId: string) {
  const { data: staff, error } = await signaturesClient()
    .from('staff')
    .select('*')
    .eq('id', staffId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!staff) {
    return null;
  }

  const [decorated] = await decorateStaffWithTemplates([
    staff as SignatureStaff,
  ]);
  if (!decorated) {
    return null;
  }

  const templates = await loadTemplates(accountId);
  const { loadAccountBranches } = await import('~/lib/brand/account-branches');
  const branches = await loadAccountBranches(accountId);
  return { staff: decorated, templates, branches };
}

export async function loadTemplateDetail(
  accountId: string,
  templateId: string,
) {
  const { data, error } = await signaturesClient()
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as SignatureTemplate | null;
}

export async function loadTemplatePreviewStaff(accountId: string) {
  const { data, error } = await signaturesClient()
    .from('staff')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as SignatureStaff | null;
}

export function getFilterOptions(staff: SignatureStaff[]) {
  return {
    branches: [
      ...new Set(staff.map((row) => row.branch).filter(Boolean)),
    ] as string[],
    departments: [
      ...new Set(staff.map((row) => row.department).filter(Boolean)),
    ] as string[],
  };
}

export async function createTemplateAndReturnId(accountId: string) {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('templates')
    .insert({
      account_id: accountId,
      name: 'New signature template',
      html_template: signatureBlocksToHtml(createMinimalSignatureDocument()),
      is_default: false,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

export async function uploadPhotoFromDataUrl(
  accountId: string,
  staffId: string,
  dataUrl: string,
): Promise<string> {
  return uploadSignaturesImageFromDataUrl(
    accountId,
    `${staffId}`,
    dataUrl,
    'Photo',
  );
}

export async function uploadBadgeFromDataUrl(
  accountId: string,
  department: string,
  dataUrl: string,
): Promise<string> {
  const slug =
    department
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'badge';

  return uploadSignaturesImageFromDataUrl(
    accountId,
    `badges/${slug}`,
    dataUrl,
    'Badge',
  );
}

const ALLOWED_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

async function uploadSignaturesImageFromDataUrl(
  accountId: string,
  objectKey: string,
  dataUrl: string,
  label: string,
): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error(`Invalid ${label.toLowerCase()} upload`);
  }

  const mimeType = match[1];
  const base64 = match[2];
  if (!mimeType || !base64 || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Invalid ${label.toLowerCase()} upload. Only PNG, JPEG, WebP, and GIF are accepted.`,
    );
  }

  const ext =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/gif'
          ? 'gif'
          : 'jpg';
  const path = `${accountId}/${objectKey}.${ext}`;
  const bytes = Buffer.from(base64, 'base64');

  // Keep uploads under typical server-action body limits after client resize.
  if (bytes.byteLength > 2_500_000) {
    throw new Error(
      `${label} is too large after processing. Try a smaller image (under ~2MB).`,
    );
  }

  const admin = getSupabaseServerAdminClient();

  const { error } = await admin.storage
    .from('signatures-photos')
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`${label} upload failed: ${error.message}`);
  }

  const { data } = admin.storage.from('signatures-photos').getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error(`${label} uploaded but public URL could not be created`);
  }

  // Bust CDN/browser caches when upsert replaces the same object key.
  const separator = data.publicUrl.includes('?') ? '&' : '?';
  return `${data.publicUrl}${separator}v=${Date.now()}`;
}
