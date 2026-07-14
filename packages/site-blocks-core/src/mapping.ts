/**
 * Canonical layoutPreset / registry keys for Site Studio block library v1.
 * Prefer these over coarse wireframe layouts (full|split|…).
 */
export const SITE_BLOCK_LAYOUT_PRESETS = [
  'header',
  'hero-split',
  'hero-centered',
  'hero-form',
  'logo-cloud',
  'feature-grid',
  'feature-alternating',
  'testimonials',
  'stats-bar',
  'pricing-table',
  'team-grid',
  'faq-accordion',
  'cta-band',
  'contact-form',
  'map-section',
  'blog-grid',
  'content-prose',
  'gallery-grid',
  'footer',
] as const;

export type SiteBlockLayoutPreset =
  (typeof SITE_BLOCK_LAYOUT_PRESETS)[number];

/** Puck component type names (PascalCase). */
export const SITE_BLOCK_TYPES = [
  'Header',
  'HeroSplit',
  'HeroCentered',
  'HeroWithForm',
  'LogoCloud',
  'FeatureGrid',
  'FeatureAlternating',
  'Testimonials',
  'StatsBar',
  'PricingTable',
  'TeamGrid',
  'FAQAccordion',
  'CTABand',
  'ContactForm',
  'MapSection',
  'BlogGrid',
  'ContentProse',
  'GalleryGrid',
  'Footer',
] as const;

export type SiteBlockType = (typeof SITE_BLOCK_TYPES)[number];

export const LAYOUT_PRESET_TO_BLOCK: Record<
  SiteBlockLayoutPreset,
  SiteBlockType
> = {
  header: 'Header',
  'hero-split': 'HeroSplit',
  'hero-centered': 'HeroCentered',
  'hero-form': 'HeroWithForm',
  'logo-cloud': 'LogoCloud',
  'feature-grid': 'FeatureGrid',
  'feature-alternating': 'FeatureAlternating',
  testimonials: 'Testimonials',
  'stats-bar': 'StatsBar',
  'pricing-table': 'PricingTable',
  'team-grid': 'TeamGrid',
  'faq-accordion': 'FAQAccordion',
  'cta-band': 'CTABand',
  'contact-form': 'ContactForm',
  'map-section': 'MapSection',
  'blog-grid': 'BlogGrid',
  'content-prose': 'ContentProse',
  'gallery-grid': 'GalleryGrid',
  footer: 'Footer',
};

export const BLOCK_TO_LAYOUT_PRESET: Record<SiteBlockType, SiteBlockLayoutPreset> =
  Object.fromEntries(
    Object.entries(LAYOUT_PRESET_TO_BLOCK).map(([preset, block]) => [
      block,
      preset,
    ]),
  ) as Record<SiteBlockType, SiteBlockLayoutPreset>;

/** Legacy section-library keys → layoutPreset. */
export const LEGACY_LIBRARY_KEY_TO_PRESET: Record<string, SiteBlockLayoutPreset> =
  {
    'nav-standard': 'header',
    'hero-split': 'hero-split',
    'hero-centered': 'hero-centered',
    'hero-form': 'hero-form',
    'logo-cloud': 'logo-cloud',
    'features-grid': 'feature-grid',
    'services-cards': 'feature-grid',
    'split-content': 'feature-alternating',
    'process-steps': 'feature-alternating',
    'stats-band': 'stats-bar',
    'testimonials-cards': 'testimonials',
    'case-studies': 'feature-grid',
    'team-grid': 'team-grid',
    'pricing-table': 'pricing-table',
    'faq-accordion': 'faq-accordion',
    'cta-band': 'cta-band',
    'contact-form': 'contact-form',
    'map-locations': 'map-section',
    'blog-grid': 'blog-grid',
    gallery: 'gallery-grid',
    'video-feature': 'content-prose',
    'footer-standard': 'footer',
  };

export function resolveLayoutPreset(input: {
  layoutPreset?: string | null;
  libraryKey?: string | null;
  componentKey?: string | null;
  layout?: string | null;
  sectionType?: string | null;
}): SiteBlockLayoutPreset {
  const direct = input.layoutPreset?.trim();
  if (direct && direct in LAYOUT_PRESET_TO_BLOCK) {
    return direct as SiteBlockLayoutPreset;
  }

  if (input.libraryKey) {
    const mapped = LEGACY_LIBRARY_KEY_TO_PRESET[input.libraryKey];
    if (mapped) return mapped;
  }

  // Symbol / component keys often encode block identity.
  const component = input.componentKey?.trim().toLowerCase();
  if (component) {
    if (component.includes('header') || component.includes('nav')) {
      return 'header';
    }
    if (component.includes('footer')) return 'footer';
  }

  switch (input.sectionType) {
    case 'nav':
      return 'header';
    case 'hero':
      return 'hero-split';
    case 'proof':
      return 'testimonials';
    case 'conversion':
      return 'cta-band';
    case 'footer':
      return 'footer';
    default:
      break;
  }

  switch (input.layout) {
    case 'split':
      return 'hero-split';
    case 'grid':
      return 'feature-grid';
    case 'cards':
      return 'testimonials';
    case 'cta':
      return 'cta-band';
    case 'footer':
      return 'footer';
    default:
      return 'content-prose';
  }
}

export function resolveBlockType(
  input: Parameters<typeof resolveLayoutPreset>[0],
): SiteBlockType {
  return LAYOUT_PRESET_TO_BLOCK[resolveLayoutPreset(input)];
}
