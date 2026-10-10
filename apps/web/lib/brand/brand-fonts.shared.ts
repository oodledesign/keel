/**
 * Curated brand typefaces a workspace can pick for its brochures (PDF and
 * online) and public pages. Every option except Helvetica ships as bundled
 * files in `lib/brand/fonts` (`{id}-regular` / `{id}-bold`, TTF for PDFs and
 * WOFF2 for the web) — adding an id here needs those four files.
 */
export const BRAND_FONT_IDS = [
  'helvetica',
  'inter',
  'dm-sans',
  'montserrat',
  'poppins',
  'lora',
  'playfair-display',
  'merriweather',
  'libre-baskerville',
] as const;

export type BrandFontId = (typeof BRAND_FONT_IDS)[number];

export type BrandFontOption = {
  id: BrandFontId;
  label: string;
  category: 'sans' | 'serif';
};

export const BRAND_FONT_OPTIONS: readonly BrandFontOption[] = [
  {
    id: 'helvetica',
    label: 'Helvetica',
    category: 'sans',
  },
  {
    id: 'inter',
    label: 'Inter',
    category: 'sans',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    category: 'sans',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    category: 'sans',
  },
  {
    id: 'poppins',
    label: 'Poppins',
    category: 'sans',
  },
  {
    id: 'lora',
    label: 'Lora',
    category: 'serif',
  },
  {
    id: 'playfair-display',
    label: 'Playfair Display',
    category: 'serif',
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    category: 'serif',
  },
  {
    id: 'libre-baskerville',
    label: 'Libre Baskerville',
    category: 'serif',
  },
];

/** PDFs keep these when the workspace hasn't chosen brand fonts. */
export const DEFAULT_PDF_HEADING_FONT: BrandFontId = 'lora';
export const DEFAULT_PDF_BODY_FONT: BrandFontId = 'helvetica';

export type BrandFonts = {
  /** Null keeps each surface's standard heading font. */
  heading: BrandFontId | null;
  /** Null keeps each surface's standard body font. */
  body: BrandFontId | null;
};

export function parseBrandFontId(raw: unknown): BrandFontId | null {
  return typeof raw === 'string' &&
    (BRAND_FONT_IDS as readonly string[]).includes(raw)
    ? (raw as BrandFontId)
    : null;
}

/** Picks the typography out of a resolved brand row. */
export function brandFontsOf(brand: {
  heading_font: BrandFontId | null;
  body_font: BrandFontId | null;
}): BrandFonts {
  return { heading: brand.heading_font, body: brand.body_font };
}

export function brandFontLabel(id: BrandFontId): string {
  return BRAND_FONT_OPTIONS.find((option) => option.id === id)?.label ?? id;
}
