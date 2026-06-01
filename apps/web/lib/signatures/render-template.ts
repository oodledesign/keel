import {
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
  type AccountBrandResolved,
} from '~/lib/brand/account-brand';

/** Row shape for template rendering (matches `signatures.staff`). */
export type SignaturesStaffRow = {
  id: string;
  account_id: string;
  ms_user_id?: string | null;
  google_user_id?: string | null;
  email: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  phone_direct: string | null;
  phone_mobile: string | null;
  branch: string | null;
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
  'award_badge_url',
  'brand_primary_color',
  'brand_secondary_color',
  'brand_accent_color',
  'brand_logo_url',
] as const;

const TRANSPARENT_PIXEL_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

type TokenKey = (typeof TOKEN_KEYS)[number];

export type RenderTemplateOptions = {
  awardBadgeUrl?: string | null;
  brand?: AccountBrandResolved | null;
};

function tokenValue(staff: SignaturesStaffRow, key: TokenKey): string {
  const v = staff[key];
  return v == null ? '' : String(v);
}

/** Replace `{{field}}` placeholders and wrap with a dark-text / system-font shell for email clients. */
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
    let replacement = '';
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
