import {
  createPlanningId,
  type WebsiteWireframeCopy,
  type WebsiteWireframeCopyItem,
  type WebsiteWireframeSection,
} from './planning-types';
import {
  findSectionLibraryEntry,
  type WebsiteSectionLibraryEntry,
} from './section-library';

export type WireframeSlotKind =
  | 'heading'
  | 'body'
  | 'button'
  | 'label'
  | 'quote'
  | 'meta';

export type WireframeSlotDef = {
  key: string;
  kind: WireframeSlotKind;
  placeholder: string;
  /** Default seed value shown in the wireframe. */
  defaultValue: string;
};

export type WireframeLibraryCopySpec = {
  slots: WireframeSlotDef[];
  itemSlots?: WireframeSlotDef[];
  defaultItemCount?: number;
};

function slot(
  key: string,
  kind: WireframeSlotKind,
  defaultValue: string,
  placeholder = defaultValue,
): WireframeSlotDef {
  return { key, kind, defaultValue, placeholder };
}

function itemDefaults(
  defs: WireframeSlotDef[],
  count: number,
  seeds?: Array<Record<string, string>>,
): WebsiteWireframeCopyItem[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = seeds?.[index] ?? {};
    const slots: Record<string, string> = {};
    for (const def of defs) {
      slots[def.key] = seed[def.key] ?? def.defaultValue;
    }
    return { id: createPlanningId(), slots };
  });
}

/** Per-library-key copy field definitions + defaults. */
export const WIREFRAME_COPY_SPECS: Record<string, WireframeLibraryCopySpec> = {
  'nav-standard': {
    slots: [
      slot('logo', 'label', 'Logo'),
      slot('link1', 'label', 'Home'),
      slot('link2', 'label', 'Services'),
      slot('link3', 'label', 'About'),
      slot('link4', 'label', 'Contact'),
      slot('cta', 'button', 'Get started'),
    ],
  },
  'hero-split': {
    slots: [
      slot('eyebrow', 'label', ''),
      slot('headline', 'heading', 'Independent expertise that delivers outcomes'),
      slot(
        'subheadline',
        'body',
        'Clear advice and hands-on delivery for organisations that need trusted construction consultancy.',
      ),
      slot('primaryCta', 'button', 'Discuss your project'),
      slot('secondaryCta', 'button', 'View services'),
    ],
  },
  'hero-centered': {
    slots: [
      slot('eyebrow', 'label', ''),
      slot('headline', 'heading', 'A clearer path from brief to delivery'),
      slot(
        'subheadline',
        'body',
        'Practical support for projects that need momentum and accountability.',
      ),
      slot('primaryCta', 'button', 'Get in touch'),
    ],
  },
  'hero-form': {
    slots: [
      slot('headline', 'heading', 'Get a clear next step'),
      slot(
        'subheadline',
        'body',
        'Tell us a little about your project and we will follow up.',
      ),
      slot('field1', 'label', 'Name'),
      slot('field2', 'label', 'Email'),
      slot('field3', 'label', 'Message'),
      slot('submit', 'button', 'Submit'),
    ],
  },
  'logo-cloud': {
    slots: [slot('eyebrow', 'label', 'Trusted by teams like')],
    itemSlots: [slot('name', 'label', 'Brand')],
    defaultItemCount: 5,
  },
  'features-grid': {
    slots: [
      slot('heading', 'heading', 'Why choose us'),
      slot('body', 'body', 'A short intro to the differentiators below.'),
    ],
    itemSlots: [
      slot('title', 'heading', 'Feature'),
      slot('body', 'body', 'One or two lines explaining the benefit.'),
    ],
    defaultItemCount: 3,
  },
  'services-cards': {
    slots: [
      slot('heading', 'heading', 'Our services'),
      slot('body', 'body', 'What we deliver for clients.'),
    ],
    itemSlots: [
      slot('title', 'heading', 'Service'),
      slot('body', 'body', 'Short description of this service.'),
      slot('cta', 'button', 'Learn more'),
    ],
    defaultItemCount: 3,
  },
  'split-content': {
    slots: [
      slot('heading', 'heading', 'Section heading'),
      slot(
        'body',
        'body',
        'Body copy that expands on the idea. Keep it concrete and scannable.',
      ),
      slot('cta', 'button', 'Learn more'),
    ],
  },
  'process-steps': {
    slots: [
      slot('heading', 'heading', 'How it works'),
      slot('body', 'body', 'A simple path from first contact to delivery.'),
    ],
    itemSlots: [
      slot('title', 'heading', 'Step'),
      slot('body', 'body', 'What happens in this step.'),
    ],
    defaultItemCount: 4,
  },
  'stats-band': {
    slots: [],
    itemSlots: [
      slot('stat', 'heading', '100%'),
      slot('label', 'label', 'Metric label'),
    ],
    defaultItemCount: 4,
  },
  'testimonials-cards': {
    slots: [slot('heading', 'heading', 'What clients say')],
    itemSlots: [
      slot('quote', 'quote', '“A short quote about the outcome.”'),
      slot('name', 'meta', 'Name'),
      slot('role', 'meta', 'Role, Company'),
    ],
    defaultItemCount: 3,
  },
  'case-studies': {
    slots: [
      slot('heading', 'heading', 'Selected work'),
      slot('body', 'body', 'Outcomes from recent projects.'),
    ],
    itemSlots: [
      slot('title', 'heading', 'Project title'),
      slot('outcome', 'body', 'Key outcome or metric.'),
    ],
    defaultItemCount: 3,
  },
  'team-grid': {
    slots: [slot('heading', 'heading', 'Meet the team')],
    itemSlots: [
      slot('name', 'heading', 'Name'),
      slot('role', 'meta', 'Role'),
      slot('bio', 'body', 'One-line specialty.'),
    ],
    defaultItemCount: 4,
  },
  'pricing-table': {
    slots: [slot('heading', 'heading', 'Pricing')],
    itemSlots: [
      slot('name', 'heading', 'Plan'),
      slot('price', 'heading', '£0'),
      slot('features', 'body', 'Feature one\nFeature two\nFeature three'),
      slot('cta', 'button', 'Choose plan'),
    ],
    defaultItemCount: 3,
  },
  'faq-accordion': {
    slots: [slot('heading', 'heading', 'Frequently asked questions')],
    itemSlots: [
      slot('question', 'heading', 'Question?'),
      slot('answer', 'body', 'Clear, helpful answer.'),
    ],
    defaultItemCount: 4,
  },
  'cta-band': {
    slots: [
      slot('headline', 'heading', 'Ready to get started?'),
      slot('body', 'body', 'One line of supporting copy.'),
      slot('cta', 'button', 'Book a call'),
    ],
  },
  'contact-form': {
    slots: [
      slot('heading', 'heading', 'Contact us'),
      slot('body', 'body', 'We usually reply within one business day.'),
      slot('field1', 'label', 'Name'),
      slot('field2', 'label', 'Email'),
      slot('field3', 'label', 'Message'),
      slot('submit', 'button', 'Send message'),
      slot('address', 'meta', '123 High Street, Town'),
      slot('phone', 'meta', '01234 567890'),
      slot('email', 'meta', 'hello@example.com'),
    ],
  },
  'map-locations': {
    slots: [
      slot('heading', 'heading', 'Where we work'),
      slot('address', 'meta', 'Full address / NAP'),
      slot('hours', 'body', 'Mon–Fri 9:00–17:00'),
      slot('locations', 'body', 'Service areas listed here.'),
    ],
  },
  'blog-grid': {
    slots: [slot('heading', 'heading', 'Latest articles')],
    itemSlots: [
      slot('title', 'heading', 'Article title'),
      slot('meta', 'meta', 'Category · 5 min read'),
    ],
    defaultItemCount: 3,
  },
  gallery: {
    slots: [slot('heading', 'heading', 'Gallery')],
    itemSlots: [slot('caption', 'label', 'Caption')],
    defaultItemCount: 6,
  },
  'video-feature': {
    slots: [
      slot('heading', 'heading', 'Watch how it works'),
      slot('body', 'body', 'Supporting copy for the video.'),
    ],
  },
  'footer-standard': {
    slots: [
      slot('brand', 'heading', 'Brand'),
      slot('blurb', 'body', 'One-line brand summary.'),
      slot('col1Title', 'label', 'Explore'),
      slot('col1Links', 'body', 'Home\nServices\nAbout'),
      slot('col2Title', 'label', 'Company'),
      slot('col2Links', 'body', 'Contact\nCareers\nPrivacy'),
      slot('contact', 'meta', 'hello@example.com'),
      slot('legal', 'meta', '© Company. All rights reserved.'),
    ],
  },
};

const GENERIC_SPEC: WireframeLibraryCopySpec = {
  slots: [
    slot('heading', 'heading', 'Section heading'),
    slot('body', 'body', 'Describe the layout intent and key copy for this block.'),
    slot('cta', 'button', 'CTA label'),
  ],
};

export function getWireframeCopySpec(
  libraryKey: string | null | undefined,
): WireframeLibraryCopySpec {
  if (!libraryKey) return GENERIC_SPEC;
  return WIREFRAME_COPY_SPECS[libraryKey] ?? GENERIC_SPEC;
}

/**
 * Strip meta labels AI often bakes into slot values
 * ("Headline: …", "Primary CTA: …", "Links: a | b | c").
 */
export function sanitizeWireframeSlotValue(value: string): string {
  let next = value.trim();
  if (!next) return '';

  // Bare meta labels sometimes land in slots as the whole value.
  if (
    /^(eyebrow|headline|supporting line|subheadline|primary cta|secondary cta|intro line|body copy|body|heading|label|cta|button|image|links?)$/i.test(
      next,
    )
  ) {
    return '';
  }

  next = next.replace(
    /^(eyebrow|headline|supporting line|subheadline|primary cta|secondary cta|intro line|body copy|body|heading|label|cta|button|links?|card\s*\d+(?:\s*[—\-–:]\s*[a-z ]+)?)\s*:\s*/i,
    '',
  );

  return next.trim();
}

/** True when a CTA/button slot is actually a dumped nav links string. */
export function isWireframeLinkDump(value: string): boolean {
  const next = value.trim();
  if (!next) return false;
  if (/^links?\s*:/i.test(next)) return true;
  const pipes = (next.match(/\|/g) ?? []).length;
  return pipes >= 2 && next.length > 28;
}

export function displayWireframeSlotValue(value: string): string {
  if (isWireframeLinkDump(value)) return '';
  return sanitizeWireframeSlotValue(value);
}

function sanitizeCopy(copy: WebsiteWireframeCopy): WebsiteWireframeCopy {
  const slots: Record<string, string> = {};
  for (const [key, value] of Object.entries(copy.slots)) {
    slots[key] = displayWireframeSlotValue(value);
  }
  return {
    slots,
    items: copy.items?.map((item) => ({
      id: item.id,
      slots: Object.fromEntries(
        Object.entries(item.slots).map(([key, value]) => [
          key,
          displayWireframeSlotValue(value),
        ]),
      ),
    })),
  };
}

export function createDefaultWireframeCopy(
  libraryKey: string | null | undefined,
): WebsiteWireframeCopy {
  const spec = getWireframeCopySpec(libraryKey);
  const slots: Record<string, string> = {};
  for (const def of spec.slots) {
    slots[def.key] = def.defaultValue;
  }

  const items =
    spec.itemSlots && spec.defaultItemCount
      ? itemDefaults(spec.itemSlots, spec.defaultItemCount)
      : undefined;

  return { slots, items };
}

/** Prefer existing copy; otherwise seed from library + optional outline. */
export function ensureWireframeCopy(
  section: Pick<
    WebsiteWireframeSection,
    'libraryKey' | 'copy' | 'copyOutline' | 'title'
  >,
): WebsiteWireframeCopy {
  if (section.copy?.slots && Object.keys(section.copy.slots).length > 0) {
    return sanitizeCopy({
      slots: { ...section.copy.slots },
      items: section.copy.items?.map((item) => ({
        id: item.id || createPlanningId(),
        slots: { ...item.slots },
      })),
    });
  }

  const seeded = createDefaultWireframeCopy(section.libraryKey ?? null);
  const outline = section.copyOutline?.trim();
  if (outline) {
    const lines = outline
      .split('\n')
      .map((line) =>
        sanitizeWireframeSlotValue(line.replace(/^[-*•]\s*/, '').trim()),
      )
      .filter(Boolean);

    const slotKeys = Object.keys(seeded.slots);
    if (slotKeys.includes('headline') && lines[0]) {
      seeded.slots.headline = lines[0]!;
    } else if (slotKeys.includes('heading') && lines[0]) {
      seeded.slots.heading = lines[0]!;
    }
    if (slotKeys.includes('subheadline') && lines[1]) {
      seeded.slots.subheadline = lines[1]!;
    } else if (slotKeys.includes('body') && lines[1]) {
      seeded.slots.body = lines[1]!;
    }
    const ctaLine = lines.find((line) =>
      /cta|button|book|get started|contact|discuss/i.test(line),
    );
    if (ctaLine && !isWireframeLinkDump(ctaLine)) {
      const cleaned = sanitizeWireframeSlotValue(ctaLine);
      if (slotKeys.includes('primaryCta')) seeded.slots.primaryCta = cleaned;
      else if (slotKeys.includes('cta')) seeded.slots.cta = cleaned;
    }
  } else if (section.title && seeded.slots.heading !== undefined) {
    seeded.slots.heading = section.title;
  } else if (section.title && seeded.slots.headline !== undefined) {
    seeded.slots.headline = section.title;
  }

  return sanitizeCopy(seeded);
}

export function libraryEntryLabel(key: string | null | undefined) {
  const entry: WebsiteSectionLibraryEntry | null = findSectionLibraryEntry(key);
  return entry?.label ?? 'Custom section';
}
