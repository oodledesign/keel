/**
 * Client-safe signature HTML helpers (no server-only imports).
 * Used by the visual template editor preview and by server renderTemplate.
 */

export const TRANSPARENT_PIXEL_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

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

export type OmissibleSignatureBlockType = (typeof OMISSABLE_BLOCK_TYPES)[number];

/**
 * Remove visual-builder contact/detail blocks whose resolved value is empty,
 * so signatures don't show icon-only gaps.
 */
export function stripEmptySignatureBlocks(
  html: string,
  values: Partial<
    Record<OmissibleSignatureBlockType, string | null | undefined>
  >,
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
