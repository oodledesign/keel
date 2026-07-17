import type { Data } from '@puckeditor/core';

import { type SiteBlocksPropsMap, buildConfig } from './config';
import {
  BLOCK_TO_LAYOUT_PRESET,
  LAYOUT_PRESET_TO_BLOCK,
  type SiteBlockLayoutPreset,
  type SiteBlockType,
  resolveBlockType,
  resolveLayoutPreset,
} from './mapping';

export type WireframeSectionInput = {
  id: string;
  title?: string;
  layoutPreset?: string | null;
  libraryKey?: string | null;
  componentKey?: string | null;
  layout?: string | null;
  sectionType?: string | null;
  copyOutline?: string | null;
  contentNotes?: string | null;
  copy?: {
    slots?: Record<string, string>;
    items?: Array<{ slots?: Record<string, string> }>;
  } | null;
};

function parseOutline(outline?: string | null) {
  if (!outline?.trim()) {
    return { headline: '', subhead: '', bullets: [] as string[], cta: '' };
  }
  const lines = outline
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines
    .filter((line) => line.startsWith('•') || line.startsWith('-'))
    .map((line) => line.replace(/^[•\-]\s*/, ''));
  const ctaLine = lines.find((line) => /^CTA:/i.test(line));
  const nonMeta = lines.filter(
    (line) =>
      !line.startsWith('•') && !line.startsWith('-') && !/^CTA:/i.test(line),
  );
  return {
    headline: nonMeta[0] ?? '',
    subhead: nonMeta[1] ?? '',
    bullets,
    cta: ctaLine?.replace(/^CTA:\s*/i, '') ?? '',
  };
}

function slot(section: WireframeSectionInput, ...keys: string[]): string {
  const slots = section.copy?.slots ?? {};
  for (const key of keys) {
    const value = slots[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

const cachedConfig = buildConfig();

function defaultPropsFor(
  type: SiteBlockType,
): SiteBlocksPropsMap[SiteBlockType] {
  const component = cachedConfig.components[type];
  return (component.defaultProps ?? {}) as SiteBlocksPropsMap[SiteBlockType];
}

/**
 * Map a Site Studio wireframe section into typed Puck block props.
 */
export function sectionToBlockProps(section: WireframeSectionInput): {
  type: SiteBlockType;
  layoutPreset: SiteBlockLayoutPreset;
  props: Record<string, unknown>;
} {
  const layoutPreset = resolveLayoutPreset(section);
  const type = LAYOUT_PRESET_TO_BLOCK[layoutPreset];
  const defaults = defaultPropsFor(type) as Record<string, unknown>;
  const outline = parseOutline(section.copyOutline);
  const items = section.copy?.items ?? [];

  const headline =
    slot(section, 'headline', 'heading', 'section heading') ||
    outline.headline ||
    section.title ||
    String(defaults.headline ?? defaults.heading ?? '');
  const subheadline =
    slot(section, 'subheadline', 'subhead', 'body') || outline.subhead;
  const primaryCta =
    slot(section, 'primaryCta', 'primary cta', 'cta', 'cta label') ||
    outline.cta ||
    String(defaults.primaryCta ?? defaults.ctaLabel ?? 'Learn more');

  switch (type) {
    case 'Header':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          brandName: slot(section, 'brandName', 'brand') || 'Brand',
          link1: slot(section, 'link1') || 'Services',
          link2: slot(section, 'link2') || 'Work',
          link3: slot(section, 'link3') || 'About',
          ctaLabel: primaryCta,
        },
      };
    case 'HeroSplit':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          eyebrow: slot(section, 'eyebrow'),
          headline,
          subheadline,
          primaryCta,
          secondaryCta: slot(section, 'secondaryCta', 'secondary cta'),
        },
      };
    case 'HeroCentered':
      return {
        type,
        layoutPreset,
        props: { ...defaults, headline, subheadline, primaryCta },
      };
    case 'HeroWithForm':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          headline,
          subheadline,
          submitLabel: primaryCta,
          field1: slot(section, 'field1') || 'Name',
          field2: slot(section, 'field2') || 'Email',
        },
      };
    case 'LogoCloud':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          eyebrow: headline || 'Trusted by',
          logos: slot(section, 'logos') || String(defaults.logos ?? ''),
        },
      };
    case 'FeatureGrid':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline,
          items: items.length
            ? items.map((item) => ({
                title: item.slots?.title ?? item.slots?.heading ?? 'Feature',
                body: item.slots?.body ?? item.slots?.blurb ?? '',
              }))
            : defaults.items,
        },
      };
    case 'FeatureAlternating':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline,
          body: subheadline || slot(section, 'body'),
          ctaLabel: primaryCta,
        },
      };
    case 'Testimonials':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline || 'What clients say',
          items: items.length
            ? items.map((item) => ({
                quote: item.slots?.quote ?? item.slots?.body ?? '',
                name: item.slots?.name ?? 'Client',
                role: item.slots?.role ?? '',
              }))
            : defaults.items,
        },
      };
    case 'StatsBar':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          items: items.length
            ? items.map((item) => ({
                value: item.slots?.value ?? item.slots?.stat ?? '—',
                label: item.slots?.label ?? item.slots?.title ?? 'Metric',
              }))
            : defaults.items,
        },
      };
    case 'PricingTable':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline || 'Pricing',
          tiers: items.length
            ? items.map((item) => ({
                name: item.slots?.name ?? item.slots?.title ?? 'Plan',
                price: item.slots?.price ?? '£—',
                features: item.slots?.features ?? item.slots?.body ?? '',
                ctaLabel: item.slots?.ctaLabel ?? item.slots?.cta ?? 'Choose',
              }))
            : defaults.tiers,
        },
      };
    case 'TeamGrid':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline || 'The team',
          members: items.length
            ? items.map((item) => ({
                name: item.slots?.name ?? 'Name',
                role: item.slots?.role ?? '',
                bio: item.slots?.bio ?? item.slots?.body ?? '',
              }))
            : defaults.members,
        },
      };
    case 'FAQAccordion':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline || 'FAQs',
          items: items.length
            ? items.map((item) => ({
                question:
                  item.slots?.question ?? item.slots?.title ?? 'Question?',
                answer: item.slots?.answer ?? item.slots?.body ?? '',
              }))
            : defaults.items,
        },
      };
    case 'CTABand':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          headline,
          subhead: subheadline,
          ctaLabel: primaryCta,
        },
      };
    case 'ContactForm':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline || 'Contact',
          body: subheadline,
          address: slot(section, 'address'),
          phone: slot(section, 'phone'),
          email: slot(section, 'email'),
          submitLabel: primaryCta || 'Send',
        },
      };
    case 'MapSection':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline || 'Find us',
          address: slot(section, 'address'),
          hours: slot(section, 'hours'),
          locations: slot(section, 'locations') || subheadline,
        },
      };
    case 'BlogGrid':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline || 'Latest writing',
          posts: items.length
            ? items.map((item) => ({
                title: item.slots?.title ?? 'Post',
                excerpt: item.slots?.excerpt ?? item.slots?.body ?? '',
              }))
            : defaults.posts,
        },
      };
    case 'ContentProse':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline,
          body:
            subheadline ||
            slot(section, 'body') ||
            outline.bullets.map((bullet) => `• ${bullet}`).join('\n') ||
            section.contentNotes ||
            '',
        },
      };
    case 'GalleryGrid':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          heading: headline || 'Gallery',
          captions:
            slot(section, 'captions') ||
            items
              .map((item) => item.slots?.title ?? item.slots?.caption)
              .filter(Boolean)
              .join(', ') ||
            String(defaults.captions ?? ''),
        },
      };
    case 'Footer':
      return {
        type,
        layoutPreset,
        props: {
          ...defaults,
          brandName: slot(section, 'brandName', 'brand') || 'Brand',
          column1: slot(section, 'column1') || 'Services\nAbout\nContact',
          column2: slot(section, 'column2') || 'Privacy\nTerms',
          legal: slot(section, 'legal') || '© Brand',
        },
      };
    default:
      return { type, layoutPreset, props: defaults };
  }
}

export function sectionsToPuckData(sections: WireframeSectionInput[]): Data {
  return {
    root: { props: {} },
    content: sections.map((section) => {
      const mapped = sectionToBlockProps(section);
      return {
        type: mapped.type,
        props: {
          ...mapped.props,
          id: section.id,
        },
      };
    }),
  };
}

export { BLOCK_TO_LAYOUT_PRESET, resolveBlockType, resolveLayoutPreset };
