import type { BrochureDisplayOptions } from '~/lib/commercial/brochure-pdf/brochure-document';
import type { BrochureListing } from '~/lib/commercial/public-brochure.shared';
import {
  formatBrochurePrice,
  formatBrochureRent,
  formatBrochureSize,
} from '~/lib/commercial/public-brochure.shared';

/**
 * Cover headline values as separate stacked lines (not a middle-dot join).
 * Display toggles omit a line; missing values are skipped.
 */
export function buildCoverPriceLines(
  listing: BrochureListing,
  display: BrochureDisplayOptions,
): string[] {
  const lines: string[] = [];

  if (display.showSize) {
    const size = formatBrochureSize(listing);
    if (size) lines.push(size);
  }

  if (display.showRent) {
    const rent = formatBrochureRent({
      ...listing,
      hideRentFromMarketing: false,
    });
    if (rent) lines.push(rent);
  }

  if (display.showPrice) {
    const price = formatBrochurePrice({
      ...listing,
      hidePriceFromMarketing: false,
    });
    if (price) lines.push(price);
  }

  return lines;
}

export function parseCoverPriceLines(headline: string): string[] {
  return headline
    .split(/\n|(?:\s*·\s*)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Strong red when brand accent is too dark to read as a sash. */
export const REDUCED_SASH_FALLBACK = '#C8102E';

export function brochureSashHex(accentHex: string | null | undefined): string {
  const cleaned = (accentHex ?? '').replace('#', '').trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) return REDUCED_SASH_FALLBACK;
  const n = Number.parseInt(cleaned, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance < 0.35) return REDUCED_SASH_FALLBACK;
  return `#${cleaned.toUpperCase()}`;
}
