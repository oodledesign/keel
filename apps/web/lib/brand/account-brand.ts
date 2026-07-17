import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

/** Defaults match the executive signature banner before custom brand is saved. */
export const DEFAULT_BRAND_PRIMARY = '#0D2344';
export const DEFAULT_BRAND_SECONDARY = '#FFFFFF';
export const DEFAULT_BRAND_ACCENT = '#57C87F';

export type AccountBrandSettingsRow = {
  account_id: string;
  primary_color: string;
  secondary_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  website_url: string | null;
  address: string | null;
  contact_email: string | null;
  phone: string | null;
};

/**
 * Resolved values for templates and emails (no null colours).
 */
export type AccountBrandResolved = {
  account_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  website_url: string | null;
  address: string | null;
  contact_email: string | null;
  phone: string | null;
};

function resolveBrand(
  row: AccountBrandSettingsRow | null,
  accountId: string,
): AccountBrandResolved {
  return {
    account_id: accountId,
    primary_color: row?.primary_color?.trim() || DEFAULT_BRAND_PRIMARY,
    secondary_color: row?.secondary_color?.trim() || DEFAULT_BRAND_SECONDARY,
    accent_color: row?.accent_color?.trim() || DEFAULT_BRAND_ACCENT,
    logo_url: toSupabasePublicStorageUrl(row?.logo_url?.trim()) || null,
    website_url: row?.website_url?.trim() || null,
    address: row?.address?.trim() || null,
    contact_email: row?.contact_email?.trim() || null,
    phone: row?.phone?.trim() || null,
  };
}

export async function loadAccountBrandResolved(
  accountId: string,
): Promise<AccountBrandResolved> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('account_brand_settings')
    .select(
      'account_id, primary_color, secondary_color, accent_color, logo_url, website_url, address, contact_email, phone',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const base = data as AccountBrandSettingsRow | null;
  let logoUrl = toSupabasePublicStorageUrl(base?.logo_url?.trim()) || null;

  if (!logoUrl) {
    const { data: accountRow } = await admin
      .from('accounts')
      .select('picture_url')
      .eq('id', accountId)
      .maybeSingle();
    logoUrl = toSupabasePublicStorageUrl(
      (accountRow?.picture_url as string | null | undefined)?.trim(),
    );
  }

  return resolveBrand(
    base ? { ...base, account_id: accountId, logo_url: logoUrl } : null,
    accountId,
  );
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?$/;

/** Returns the value if it is a valid CSS hex colour, otherwise the fallback. */
function safeCssColor(value: string, fallback: string): string {
  return HEX_COLOR_RE.test(value) ? value : fallback;
}

/**
 * Wraps transactional email HTML with an optional brand bar + logo (table layout for clients).
 */
export function wrapEmailHtmlWithBrand(params: {
  brand: AccountBrandResolved;
  innerHtml: string;
  /** Body text colour on the white content area */
  contentColor?: string;
}): string {
  const { brand, innerHtml } = params;
  const contentColor = safeCssColor(
    params.contentColor ?? '#09111F',
    '#09111F',
  );
  const primaryColor = safeCssColor(brand.primary_color, DEFAULT_BRAND_PRIMARY);
  const logo =
    brand.logo_url &&
    `<img src="${brand.logo_url}" alt="" height="40" style="display:block;max-height:40px;width:auto;border:0;" />`;

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td style="background:${primaryColor};padding:16px 20px;">
      ${logo ?? ''}
    </td>
  </tr>
  <tr>
    <td style="padding:20px;font-family:Poppins,Arial,sans-serif;color:${contentColor};line-height:1.6;">
      ${innerHtml}
    </td>
  </tr>
</table>`.trim();
}
