import type { AccountBranch } from '~/lib/brand/account-branches';
import {
  type AccountBrandResolved,
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
} from '~/lib/brand/account-brand';

/** Row shape for template rendering (matches `signatures.staff`). */
export type SignaturesStaffRow = {
  id: string;
  account_id: string;
  ms_user_id?: string | null;
  google_user_id?: string | null;
  email: string;
  signature_email?: string | null;
  full_name: string | null;
  credentials?: string | null;
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
  'company_icon_badge_url',
  'brand_logo_url',
  'award_badge_url',
  'award_badges',
  'signature_custom_text',
  'brand_primary_color',
  'brand_secondary_color',
  'brand_accent_color',
] as const;

export const TRANSPARENT_PIXEL_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

type TokenKey = (typeof TOKEN_KEYS)[number];

export type RenderTemplateOptions = {
  awardBadgeUrl?: string | null;
  /** Pre-rendered HTML for one or more matching award badge images. */
  awardBadgesHtml?: string | null;
  /** Pre-rendered HTML for matching shared custom-text snippets. */
  signatureCustomTextHtml?: string | null;
  brand?: AccountBrandResolved | null;
  branch?: AccountBranch | null;
  /** Signatures workspace company logo (full wordmark). */
  companyLogoUrl?: string | null;
  /** Signatures workspace company icon (square mark). */
  companyIconUrl?: string | null;
  /**
   * When false, never show company icon on the photo (badge or no-photo fill).
   * Default true.
   */
  showPhotoBadge?: boolean;
};

/** Builder block types omitted when the resolved value is blank. */
const OMISSABLE_BLOCK_TYPES = [
  'phone_direct',
  'phone_mobile',
  'email',
  'website',
  'address',
  'department',
  'branch',
  'title',
  'credentials',
] as const;

type OmissibleBlockType = (typeof OMISSABLE_BLOCK_TYPES)[number];

/**
 * Remove visual-builder contact/detail blocks whose resolved value is empty,
 * so signatures don't show icon-only gaps.
 */
export function stripEmptySignatureBlocks(
  html: string,
  values: Partial<Record<OmissibleBlockType, string | null | undefined>>,
): string {
  let result = html;
  for (const type of OMISSABLE_BLOCK_TYPES) {
    if ((values[type] ?? '').trim()) {
      continue;
    }
    result = result.replace(
      new RegExp(
        `<!--\\s*ozer-block\\s+[^>]*?\\btype="${type}"[^>]*?-->[\\s\\S]*?<!--\\s*/ozer-block\\s*-->\\s*`,
        'gi',
      ),
      '',
    );
  }
  return result;
}

/** Drop transparent 24×24 badge imgs (avoids a white ring with no icon). */
export function stripTransparentBadgeImages(html: string): string {
  const escaped = TRANSPARENT_PIXEL_GIF.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  return html.replace(
    new RegExp(
      `<img\\b[^>]*\\bsrc="${escaped}"[^>]*\\bwidth="24"[^>]*/?>`,
      'gi',
    ),
    '',
  );
}

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
  return brand?.logo_url?.trim() ? brand.logo_url.trim() : TRANSPARENT_PIXEL_GIF;
}

/** Company logo with brand business logo fallback. */
export function resolveCompanyLogoUrl(
  companyLogoUrl: string | null | undefined,
  brand: AccountBrandResolved | null | undefined,
): string {
  const company = companyLogoUrl?.trim();
  if (company) return company;
  return brandLogoUrl(brand);
}

/**
 * Photo / badge URLs for the visual photo block.
 * - Has staff photo → photo shows person; badge shows company icon (if any).
 * - No staff photo → photo slot shows company icon (if any); badge hidden.
 * - showPhotoBadge false → never use company icon on the photo.
 */
export function resolvePhotoAndBadgeUrls(input: {
  staffPhotoUrl: string | null | undefined;
  companyIconUrl: string | null | undefined;
  showPhotoBadge?: boolean;
}): { photoUrl: string; badgeUrl: string } {
  const photo = input.staffPhotoUrl?.trim() || '';
  const icon =
    input.showPhotoBadge === false
      ? ''
      : input.companyIconUrl?.trim() || '';

  if (photo) {
    return {
      photoUrl: photo,
      badgeUrl: icon || TRANSPARENT_PIXEL_GIF,
    };
  }

  return {
    photoUrl: icon || TRANSPARENT_PIXEL_GIF,
    badgeUrl: TRANSPARENT_PIXEL_GIF,
  };
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
  const brandLogo = brandLogoUrl(options?.brand);
  const companyLogo = resolveCompanyLogoUrl(
    options?.companyLogoUrl,
    options?.brand,
  );
  const { photoUrl, badgeUrl } = resolvePhotoAndBadgeUrls({
    staffPhotoUrl: effectiveStaff.photo_url,
    companyIconUrl: options?.companyIconUrl,
    showPhotoBadge: options?.showPhotoBadge,
  });

  let html = htmlTemplate;
  for (const key of TOKEN_KEYS) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    let val = tokenValue(effectiveStaff, key);
    if (key === 'photo_url') {
      val = photoUrl;
    }
    html = html.replace(re, val);
  }

  for (const key of OPTIONAL_TEMPLATE_KEYS) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    let replacement = '';
    if (key === 'company_logo_url') {
      replacement = companyLogo;
    } else if (key === 'brand_logo_url') {
      replacement = brandLogo;
    } else if (key === 'company_icon_badge_url') {
      replacement = badgeUrl;
    } else if (key === 'award_badge_url') {
      replacement = options?.awardBadgeUrl?.trim() || TRANSPARENT_PIXEL_GIF;
    } else if (key === 'award_badges') {
      replacement = options?.awardBadgesHtml?.trim() || '';
    } else if (key === 'signature_custom_text') {
      replacement = options?.signatureCustomTextHtml?.trim() || '';
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
    } else if (key === 'credentials') {
      replacement = staff.credentials?.trim() || '';
    }
    html = html.replace(re, replacement);
  }

  html = stripEmptySignatureBlocks(html, {
    phone_direct: effectiveStaff.phone_direct,
    phone_mobile: effectiveStaff.phone_mobile,
    email: effectiveStaff.email,
    website: options?.brand?.website_url,
    address,
    department: effectiveStaff.department,
    branch: effectiveStaff.branch,
    title: effectiveStaff.job_title,
    credentials: staff.credentials,
  });
  html = stripTransparentBadgeImages(html);
  html = normalizeLegacySignatureChrome(html);

  const inner = html.trim();

  // Soft shell only: mid-grey default text (not pure #000) so dark-mode clients
  // can invert more gracefully. No forced background canvas.
  return `<div style="color:#333333;font-family:Arial,Calibri,Georgia,sans-serif;line-height:1.4;">${inner}</div>`;
}

/**
 * Soft fixes for older builder HTML: drop the former canvas radius (looked like a
 * thick border) and swap contact icons to the light set on dark canvases.
 */
export function normalizeLegacySignatureChrome(html: string): string {
  let result = html.replace(/border-radius:\s*8px;?/gi, '');

  const solidMatch = result.match(/\bbg="solid:(#[0-9A-Fa-f]{6})"/i);
  const gradientMatch = result.match(
    /\bbg="gradient:(#[0-9A-Fa-f]{6}):(#[0-9A-Fa-f]{6})"/i,
  );

  let useLightIcons = false;
  if (solidMatch?.[1]) {
    useLightIcons = isLightTextOnHex(solidMatch[1]);
  } else if (gradientMatch?.[1] && gradientMatch[2]) {
    useLightIcons =
      isLightTextOnHex(gradientMatch[1]) || isLightTextOnHex(gradientMatch[2]);
  }

  if (useLightIcons) {
    result = result.replace(
      /\/brand\/signature-icons\/(email|phone|mobile|website|address)\.png/g,
      '/brand/signature-icons/$1-light.png',
    );
  }

  return result;
}

function isLightTextOnHex(hex: string): boolean {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return false;
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  // Same heuristic as paletteForBackground: prefer light text when contrast wins.
  const darkContrast = (luminance + 0.05) / (0.04 + 0.05);
  const lightContrast = (0.9 + 0.05) / (luminance + 0.05);
  return lightContrast >= darkContrast;
}
