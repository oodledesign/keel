import type { Config } from '@puckeditor/core';

import {
  blogGridConfig,
  contactFormConfig,
  contentProseConfig,
  ctaBandConfig,
  faqAccordionConfig,
  featureAlternatingConfig,
  featureGridConfig,
  footerConfig,
  galleryGridConfig,
  headerConfig,
  heroCenteredConfig,
  heroSplitConfig,
  heroWithFormConfig,
  logoCloudConfig,
  mapSectionConfig,
  pricingTableConfig,
  statsBarConfig,
  teamGridConfig,
  testimonialsConfig,
  type BlogGridProps,
  type ContactFormProps,
  type ContentProseProps,
  type CTABandProps,
  type FAQAccordionProps,
  type FeatureAlternatingProps,
  type FeatureGridProps,
  type FooterProps,
  type GalleryGridProps,
  type HeaderProps,
  type HeroCenteredProps,
  type HeroSplitProps,
  type HeroWithFormProps,
  type LogoCloudProps,
  type MapSectionProps,
  type PricingTableProps,
  type StatsBarProps,
  type TeamGridProps,
  type TestimonialsProps,
} from './blocks/components';
import type { SiteBlockType } from './mapping';
import { SITE_BLOCK_TYPES } from './mapping';

export type SiteBlocksPropsMap = {
  Header: HeaderProps;
  HeroSplit: HeroSplitProps;
  HeroCentered: HeroCenteredProps;
  HeroWithForm: HeroWithFormProps;
  LogoCloud: LogoCloudProps;
  FeatureGrid: FeatureGridProps;
  FeatureAlternating: FeatureAlternatingProps;
  Testimonials: TestimonialsProps;
  StatsBar: StatsBarProps;
  PricingTable: PricingTableProps;
  TeamGrid: TeamGridProps;
  FAQAccordion: FAQAccordionProps;
  CTABand: CTABandProps;
  ContactForm: ContactFormProps;
  MapSection: MapSectionProps;
  BlogGrid: BlogGridProps;
  ContentProse: ContentProseProps;
  GalleryGrid: GalleryGridProps;
  Footer: FooterProps;
};

export type SiteBlocksConfig = Config<SiteBlocksPropsMap>;

export type BuildConfigOptions = {
  /** Include only these block types (defaults to all). */
  include?: SiteBlockType[];
  /** Remove these block types after include filter. */
  exclude?: SiteBlockType[];
  /** Merge additional / override component configs (client packages). */
  extensions?: Partial<{
    [K in SiteBlockType]: SiteBlocksConfig['components'][K];
  }>;
};

const ALL_COMPONENTS: SiteBlocksConfig['components'] = {
  Header: headerConfig,
  HeroSplit: heroSplitConfig,
  HeroCentered: heroCenteredConfig,
  HeroWithForm: heroWithFormConfig,
  LogoCloud: logoCloudConfig,
  FeatureGrid: featureGridConfig,
  FeatureAlternating: featureAlternatingConfig,
  Testimonials: testimonialsConfig,
  StatsBar: statsBarConfig,
  PricingTable: pricingTableConfig,
  TeamGrid: teamGridConfig,
  FAQAccordion: faqAccordionConfig,
  CTABand: ctaBandConfig,
  ContactForm: contactFormConfig,
  MapSection: mapSectionConfig,
  BlogGrid: blogGridConfig,
  ContentProse: contentProseConfig,
  GalleryGrid: galleryGridConfig,
  Footer: footerConfig,
};

/**
 * Build a Puck config registering Site Studio block library v1.
 * Client packages can subset/merge via include/exclude/extensions.
 */
export function buildConfig(options: BuildConfigOptions = {}): SiteBlocksConfig {
  const include = new Set(options.include ?? SITE_BLOCK_TYPES);
  for (const key of options.exclude ?? []) {
    include.delete(key);
  }

  const components: Record<string, unknown> = {};
  for (const key of SITE_BLOCK_TYPES) {
    if (!include.has(key)) continue;
    const base = ALL_COMPONENTS[key];
    const extension = options.extensions?.[key];
    components[key] = extension ? { ...base, ...extension } : base;
  }

  return {
    components: components as SiteBlocksConfig['components'],
    categories: {
      navigation: { title: 'Navigation', components: ['Header', 'Footer'] },
      heroes: {
        title: 'Heroes',
        components: ['HeroSplit', 'HeroCentered', 'HeroWithForm'],
      },
      proof: {
        title: 'Proof',
        components: ['LogoCloud', 'Testimonials', 'StatsBar'],
      },
      content: {
        title: 'Content',
        components: [
          'FeatureGrid',
          'FeatureAlternating',
          'TeamGrid',
          'FAQAccordion',
          'BlogGrid',
          'ContentProse',
          'GalleryGrid',
          'MapSection',
        ],
      },
      conversion: {
        title: 'Conversion',
        components: ['PricingTable', 'CTABand', 'ContactForm'],
      },
    },
  };
}

export const defaultSiteBlocksConfig = buildConfig();
