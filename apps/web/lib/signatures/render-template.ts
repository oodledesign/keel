import {
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
  type AccountBrandResolved,
} from '~/lib/brand/account-brand';
import type { AccountBranch } from '~/lib/brand/account-branches';

/** Row shape for template rendering (matches `signatures.staff`). */
export type SignaturesStaffRow = {
  id: string;
  account_id: string;
  ms_user_id?: string | null;
  google_user_id?: string | null;
  email: string;
  signature_email?: string | null;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  phone_direct: string | null;
  phone_mobile: string | null;
  branch: string | null;
  branch_id?: string | null;
  photo_url: string | null;
  signature_status?: string | null;
  signature_pushed_at?: string | null;
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

const OPTIONAL_TEMPLATE_KEYS = [
  'credentials',
  'website',
  'address',
  'company_logo_url',
  'brand_logo_url',
  'award_badge_url',
  'brand_primary_color',
  'brand_secondary_color',
  'brand_accent_color',
] as const;

const TRANSPARENT_PIXEL_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

type TokenKey = (typeof TOKEN_KEYS)[number];

export type RenderTemplateOptions = {
  awardBadgeUrl?: string | null;
  brand?: AccountBrandResolved | null;
  branch?: AccountBranch | null;
};

function tokenValue(staff: SignaturesStaffRow, key: TokenKey): string {
  const v = staff[key];
  return v == null ? '' : String(v);
}

/** Apply branch + personal overrides for signature contact fields. */
export function applySignatureContactFields(
  staff: SignaturesStaffRow,
  branch: AccountBranch | null | undefined,
): SignaturesStaffRow {
  const phoneOverride = staff.phone_direct?.trim();
  const emailOverride = staff.signature_email?.trim();

  return {
    ...staff,
    branch: branch?.name?.trim() || staff.branch?.trim() || '',
    phone_direct: phoneOverride || branch?.phone?.trim() || '',
    email: emailOverride || staff.email?.trim() || branch?.email?.trim() || '',
  };
}

function brandLogoUrl(brand: AccountBrandResolved | null | undefined) {
  return brand?.logo_url?.trim() ? brand.logo_url : TRANSPARENT_PIXEL_GIF;
}

/** Replace `{{field}}` placeholders and wrap with a dark-text / system-font shell for email clients. */
export function renderTemplate(
  htmlTemplate: string,
  staff: SignaturesStaffRow,
  options?: RenderTemplateOptions,
): string {
  const branch = options?.branch ?? null;
  const effectiveStaff = applySignatureContactFields(staff, branch);
  const address =
    branch?.address?.trim() || options?.brand?.address?.trim() || '';
  const logo = brandLogoUrl(options?.brand);

  let html = htmlTemplate;
  for (const key of TOKEN_KEYS) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    let val = tokenValue(effectiveStaff, key);
    if (key === 'photo_url' && !val) {
      val = TRANSPARENT_PIXEL_GIF;
    }
    html = html.replace(re, val);
  }

  for (const key of OPTIONAL_TEMPLATE_KEYS) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    let replacement = '';
    if (key === 'company_logo_url' || key === 'brand_logo_url') {
      replacement = logo;
    } else if (key === 'award_badge_url') {
      replacement = options?.awardBadgeUrl?.trim() || TRANSPARENT_PIXEL_GIF;
    } else if (key === 'brand_primary_color') {
      replacement = options?.brand?.primary_color ?? DEFAULT_BRAND_PRIMARY;
    } else if (key === 'brand_secondary_color') {
      replacement = options?.brand?.secondary_color ?? DEFAULT_BRAND_SECONDARY;
    } else if (key === 'brand_accent_color') {
      replacement = options?.brand?.accent_color ?? DEFAULT_BRAND_ACCENT;
    } else if (key === 'website') {
      replacement = options?.brand?.website_url?.trim() || '';
    } else if (key === 'address') {
      replacement = address;
    }
    html = html.replace(re, replacement);
  }

  const inner = html.trim();

  // Soft shell only: set a default text colour. Do not force a white canvas —
  // many signatures sit on the client's own background, and a hard #fff block
  // looks wrong. Dark-mode inversion is client-specific and not controllable.
  return `<div style="color:#000000;font-family:Arial,Calibri,Georgia,sans-serif;line-height:1.4;">${inner}</div>`;
}
