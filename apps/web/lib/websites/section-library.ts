import type {
  WebsiteSectionType,
  WebsiteWireframeLayout,
} from './planning-types';

/**
 * Site Studio section library v1 — ~20 named section variants that wireframe
 * sections can bind to. Exports (Webflow Client-First, Astro, Next, prompts)
 * use these keys to emit consistent structure.
 */
export type WebsiteSectionLibraryEntry = {
  key: string;
  label: string;
  category: WebsiteSectionType;
  layout: WebsiteWireframeLayout;
  hint: string;
  /** Copy slots the section expects (drives AI copy outlines + export props). */
  copySlots: string[];
  /** Client-First-style component name (kebab, used for class stubs). */
  clientFirstName: string;
};

export const WEBSITE_SECTION_LIBRARY: WebsiteSectionLibraryEntry[] = [
  {
    key: 'nav-standard',
    label: 'Navbar',
    category: 'nav',
    layout: 'full',
    hint: 'Logo, links, CTA button',
    copySlots: ['nav links', 'cta label'],
    clientFirstName: 'nav',
  },
  {
    key: 'hero-split',
    label: 'Hero — split',
    category: 'hero',
    layout: 'split',
    hint: 'Headline + copy left, image right',
    copySlots: ['headline', 'subheadline', 'primary cta', 'secondary cta'],
    clientFirstName: 'hero-split',
  },
  {
    key: 'hero-centered',
    label: 'Hero — centered',
    category: 'hero',
    layout: 'full',
    hint: 'Centered headline over full-bleed media',
    copySlots: ['headline', 'subheadline', 'primary cta'],
    clientFirstName: 'hero-center',
  },
  {
    key: 'hero-form',
    label: 'Hero — with form',
    category: 'hero',
    layout: 'split',
    hint: 'Value prop + lead capture form',
    copySlots: ['headline', 'subheadline', 'form fields', 'submit label'],
    clientFirstName: 'hero-form',
  },
  {
    key: 'logo-cloud',
    label: 'Logo cloud',
    category: 'proof',
    layout: 'grid',
    hint: 'Client / partner logos strip',
    copySlots: ['eyebrow'],
    clientFirstName: 'logo-strip',
  },
  {
    key: 'features-grid',
    label: 'Features grid',
    category: 'content',
    layout: 'grid',
    hint: '3–6 differentiators with icons',
    copySlots: ['section heading', 'feature titles', 'feature blurbs'],
    clientFirstName: 'features-grid',
  },
  {
    key: 'services-cards',
    label: 'Services cards',
    category: 'content',
    layout: 'cards',
    hint: 'Core services with links to detail pages',
    copySlots: ['section heading', 'service titles', 'service blurbs'],
    clientFirstName: 'services-cards',
  },
  {
    key: 'split-content',
    label: 'Split content',
    category: 'content',
    layout: 'split',
    hint: 'Image + copy, alternating rows',
    copySlots: ['heading', 'body', 'cta'],
    clientFirstName: 'content-split',
  },
  {
    key: 'process-steps',
    label: 'Process steps',
    category: 'content',
    layout: 'grid',
    hint: 'How it works, 3–4 numbered steps',
    copySlots: ['section heading', 'step titles', 'step blurbs'],
    clientFirstName: 'process-steps',
  },
  {
    key: 'stats-band',
    label: 'Stats band',
    category: 'proof',
    layout: 'grid',
    hint: 'Key numbers with labels',
    copySlots: ['stats', 'labels'],
    clientFirstName: 'stats-band',
  },
  {
    key: 'testimonials-cards',
    label: 'Testimonials',
    category: 'proof',
    layout: 'cards',
    hint: 'Quotes with names and roles',
    copySlots: ['quotes', 'names', 'roles'],
    clientFirstName: 'testimonials',
  },
  {
    key: 'case-studies',
    label: 'Case studies / portfolio',
    category: 'proof',
    layout: 'cards',
    hint: 'Work examples with outcomes',
    copySlots: ['section heading', 'project titles', 'outcomes'],
    clientFirstName: 'case-studies',
  },
  {
    key: 'team-grid',
    label: 'Team grid',
    category: 'content',
    layout: 'cards',
    hint: 'Photos, names, specialties',
    copySlots: ['section heading', 'names', 'roles', 'bios'],
    clientFirstName: 'team-grid',
  },
  {
    key: 'pricing-table',
    label: 'Pricing',
    category: 'conversion',
    layout: 'cards',
    hint: 'Tiers with features and CTAs',
    copySlots: ['tier names', 'prices', 'feature lists', 'cta labels'],
    clientFirstName: 'pricing',
  },
  {
    key: 'faq-accordion',
    label: 'FAQ',
    category: 'content',
    layout: 'full',
    hint: 'Answer blocks — feeds AEO/JSON-LD',
    copySlots: ['questions', 'answers'],
    clientFirstName: 'faq',
  },
  {
    key: 'cta-band',
    label: 'CTA band',
    category: 'conversion',
    layout: 'cta',
    hint: 'Final conversion strip',
    copySlots: ['headline', 'cta label'],
    clientFirstName: 'cta-band',
  },
  {
    key: 'contact-form',
    label: 'Contact form',
    category: 'conversion',
    layout: 'split',
    hint: 'Form + contact details',
    copySlots: ['heading', 'form fields', 'address', 'phone', 'email'],
    clientFirstName: 'contact-form',
  },
  {
    key: 'map-locations',
    label: 'Map / locations',
    category: 'content',
    layout: 'split',
    hint: 'Service areas, NAP details, opening hours',
    copySlots: ['locations', 'address', 'hours'],
    clientFirstName: 'locations',
  },
  {
    key: 'blog-grid',
    label: 'Blog grid',
    category: 'content',
    layout: 'cards',
    hint: 'Latest posts with images',
    copySlots: ['section heading'],
    clientFirstName: 'blog-grid',
  },
  {
    key: 'gallery',
    label: 'Gallery',
    category: 'content',
    layout: 'grid',
    hint: 'Image grid or masonry',
    copySlots: ['section heading', 'captions'],
    clientFirstName: 'gallery',
  },
  {
    key: 'video-feature',
    label: 'Video feature',
    category: 'content',
    layout: 'full',
    hint: 'Embedded video with supporting copy',
    copySlots: ['heading', 'body'],
    clientFirstName: 'video-feature',
  },
  {
    key: 'footer-standard',
    label: 'Footer',
    category: 'footer',
    layout: 'footer',
    hint: 'Nav columns, contact, legal',
    copySlots: ['nav columns', 'contact details', 'legal links'],
    clientFirstName: 'footer',
  },
];

export function findSectionLibraryEntry(key: string | null | undefined) {
  if (!key) return null;
  return WEBSITE_SECTION_LIBRARY.find((entry) => entry.key === key) ?? null;
}

export function sectionLibraryByCategory() {
  const groups = new Map<WebsiteSectionType, WebsiteSectionLibraryEntry[]>();
  for (const entry of WEBSITE_SECTION_LIBRARY) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }
  return groups;
}
