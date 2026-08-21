import { SUGGESTED_LISTING_AMENITIES } from '../_lib/schema/listings.schema';

export type DisposalSearchHit = {
  /** Stable id for React keys */
  id: string;
  /** Top-level disposal tab label */
  page: string;
  /** Path suffix under the listing base ('' for overview) */
  href: string;
  /** Optional in-page anchor */
  hash?: string;
  /** Primary result title */
  title: string;
  /** Breadcrumb-style context under the page */
  context?: string;
  /** Extra terms to match (not always shown) */
  keywords: string[];
};

/**
 * Static index of disposal detail headings / subheadings / known field labels
 * so agents can jump to the right tab without remembering where things live.
 */
export const DISPOSAL_PAGE_SEARCH_INDEX: DisposalSearchHit[] = [
  // Overview
  {
    id: 'overview',
    page: 'Overview',
    href: '',
    title: 'Overview',
    keywords: ['summary', 'dashboard', 'home'],
  },
  {
    id: 'overview-people',
    page: 'Overview',
    href: '',
    title: 'People',
    context: 'Landlords & contacts',
    keywords: ['landlord', 'phone', 'call', 'contact', 'parties'],
  },
  {
    id: 'overview-interest-funnel',
    page: 'Overview',
    href: '',
    title: 'Interest funnel',
    keywords: ['enquiries', 'viewings', 'deals'],
  },
  {
    id: 'overview-details',
    page: 'Overview',
    href: '',
    title: 'Property details',
    keywords: ['address', 'rent', 'price', 'size', 'tenure', 'sector'],
  },
  {
    id: 'overview-map',
    page: 'Overview',
    href: '',
    title: 'Map',
    keywords: ['location', 'map', 'pin', 'geocode'],
  },
  {
    id: 'overview-matches',
    page: 'Overview',
    href: '',
    title: 'Suggested matches',
    keywords: ['requirements', 'matching', 'requirements'],
  },

  // Marketing
  {
    id: 'marketing',
    page: 'Marketing',
    href: '/marketing',
    title: 'Marketing',
    keywords: ['copy', 'publish', 'portal'],
  },
  {
    id: 'marketing-summary',
    page: 'Marketing',
    href: '/marketing',
    hash: 'summary-key-points',
    title: 'Summary & key points',
    context: 'Marketing',
    keywords: ['headline', 'bullets', 'keypoints', 'key points'],
  },
  {
    id: 'marketing-amenities',
    page: 'Marketing',
    href: '/marketing',
    hash: 'amenities',
    title: 'Amenities & specifications',
    context: 'Marketing',
    keywords: [
      'amenities',
      'specifications',
      'features',
      'parking',
      'car park',
      'car parking',
      'parking spaces',
      'bike',
      'shower',
      'epc',
      'esg',
      ...SUGGESTED_LISTING_AMENITIES.map((a) => a.toLowerCase()),
    ],
  },
  {
    id: 'marketing-parking',
    page: 'Marketing',
    href: '/marketing',
    hash: 'amenities',
    title: 'Parking',
    context: 'Marketing · Amenities',
    keywords: ['parking', 'car park', 'car parking', 'spaces', 'rightmove'],
  },
  ...SUGGESTED_LISTING_AMENITIES.map((amenity) => ({
    id: `amenity-${amenity.toLowerCase().replace(/\s+/g, '-')}`,
    page: 'Marketing',
    href: '/marketing',
    hash: 'amenities',
    title: amenity,
    context: 'Marketing · Amenities',
    keywords: [amenity.toLowerCase(), 'amenity', 'amenities', 'specification'],
  })),
  {
    id: 'marketing-text',
    page: 'Marketing',
    href: '/marketing',
    hash: 'marketing-text',
    title: 'Marketing text',
    context: 'Description & location copy',
    keywords: ['description', 'location', 'copy', 'write'],
  },
  {
    id: 'marketing-accommodation',
    page: 'Marketing',
    href: '/marketing',
    hash: 'accommodation',
    title: 'Accommodation',
    context: 'Units & floors shortcut',
    keywords: ['floors', 'units', 'availability', 'schedule'],
  },
  {
    id: 'marketing-agents',
    page: 'Marketing',
    href: '/marketing',
    hash: 'agent-contacts',
    title: 'Agents',
    context: 'Public agent contacts',
    keywords: ['acting agent', 'contact', 'phone'],
  },
  {
    id: 'marketing-publish',
    page: 'Marketing',
    href: '/marketing',
    hash: 'publish-options',
    title: 'Publish options',
    context: 'Marketing',
    keywords: ['rightmove', 'portal', 'publish', 'marketplace'],
  },

  // Media
  {
    id: 'media',
    page: 'Media',
    href: '/media',
    title: 'Media',
    keywords: ['photos', 'images', 'upload'],
  },
  {
    id: 'media-images',
    page: 'Media',
    href: '/media',
    title: 'Images',
    context: 'Media',
    keywords: ['photos', 'gallery', 'cover'],
  },
  {
    id: 'media-floorplans',
    page: 'Media',
    href: '/media',
    title: 'Floorplans',
    context: 'Media',
    keywords: ['floor plan', 'plans'],
  },
  {
    id: 'media-epc',
    page: 'Media',
    href: '/media',
    title: 'EPC',
    context: 'Media',
    keywords: ['energy', 'certificate', 'rating'],
  },
  {
    id: 'media-brochure',
    page: 'Media',
    href: '/media',
    title: 'Brochure',
    context: 'Media',
    keywords: ['pdf', 'particulars'],
  },
  {
    id: 'media-video',
    page: 'Media',
    href: '/media',
    title: 'Video',
    context: 'Media',
    keywords: ['film', 'tour'],
  },

  // Interest
  {
    id: 'interest',
    page: 'Interest',
    href: '/interest',
    title: 'Interest',
    keywords: ['enquiries', 'applicants', 'pipeline', 'matches'],
  },
  {
    id: 'interest-enquiries',
    page: 'Interest',
    href: '/interest',
    title: 'Enquiries',
    context: 'Interest',
    keywords: ['leads', 'inbound'],
  },
  {
    id: 'interest-viewings',
    page: 'Interest',
    href: '/interest',
    title: 'Viewings',
    context: 'Interest',
    keywords: ['appointments', 'tours', 'feedback'],
  },

  // Availability
  {
    id: 'availability',
    page: 'Availability',
    href: '/availability',
    title: 'Availability',
    keywords: ['units', 'floors', 'schedule', 'accommodation', 'sizes'],
  },

  // Management
  {
    id: 'management',
    page: 'Management',
    href: '/management',
    title: 'Management',
    keywords: ['settings', 'instruction', 'admin'],
  },
  {
    id: 'management-readiness',
    page: 'Management',
    href: '/management',
    hash: 'marketing-readiness',
    title: 'Marketing readiness',
    context: 'Management',
    keywords: ['checklist', 'ready', 'publish'],
  },
  {
    id: 'management-instruction',
    page: 'Management',
    href: '/management',
    hash: 'instruction',
    title: 'Instruction',
    context: 'Management',
    keywords: [
      'terms of engagement',
      'toe',
      'instructed',
      'exclusive',
      'joint',
    ],
  },
  {
    id: 'management-assignment',
    page: 'Management',
    href: '/management',
    hash: 'assignment',
    title: 'Assignment',
    context: 'Acting agents, PA, owner, office',
    keywords: [
      'acting agent',
      'pa',
      'record owner',
      'team',
      'branch',
      'office',
      'rightmove',
    ],
  },
  {
    id: 'management-co-agents',
    page: 'Management',
    href: '/management',
    hash: 'co-agents',
    title: 'Co-agents',
    context: 'Management',
    keywords: ['joint agent', 'co marketing', 'other agents'],
  },
  {
    id: 'management-parties',
    page: 'Management',
    href: '/management',
    hash: 'parties',
    title: 'Parties & CRM property',
    context: 'Landlords and linked property',
    keywords: [
      'landlord',
      'people',
      'contacts',
      'property',
      'solicitor',
      'tenant',
      'managing agent',
    ],
  },
  {
    id: 'management-attributes',
    page: 'Management',
    href: '/management',
    hash: 'advanced-attrs',
    title: 'Attributes',
    context: 'Reference, BREEAM, condition…',
    keywords: [
      'reference',
      'project code',
      'breeam',
      'condition',
      'floor plate',
      'size accuracy',
      'controlled by',
    ],
  },
  {
    id: 'management-private-media',
    page: 'Management',
    href: '/management',
    hash: 'private-media',
    title: 'Private media',
    context: 'Management',
    keywords: ['confidential', 'internal files'],
  },
  {
    id: 'management-publishing',
    page: 'Management',
    href: '/management',
    hash: 'publishing',
    title: 'Publishing',
    context: 'Portal sync',
    keywords: ['rightmove', 'property hive', 'portals', 'feeds'],
  },

  // Activity
  {
    id: 'activity',
    page: 'Activity',
    href: '/activity',
    title: 'Activity',
    keywords: ['history', 'timeline', 'audit', 'events', 'log'],
  },

  // Brochure (linked from media / header actions)
  {
    id: 'brochure',
    page: 'Brochure',
    href: '/brochure',
    title: 'Brochure editor',
    keywords: ['pdf', 'particulars', 'pages', 'layout'],
  },
  {
    id: 'preview',
    page: 'Preview',
    href: '/preview',
    title: 'Preview',
    keywords: ['public', 'share', 'listing page'],
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function searchDisposalPages(
  query: string,
  limit = 12,
): DisposalSearchHit[] {
  const q = normalize(query);
  if (q.length < 1) return [];

  const tokens = q.split(' ').filter(Boolean);
  const scored: Array<{ hit: DisposalSearchHit; score: number }> = [];

  for (const hit of DISPOSAL_PAGE_SEARCH_INDEX) {
    const haystack = normalize(
      [hit.title, hit.page, hit.context, ...hit.keywords]
        .filter(Boolean)
        .join(' '),
    );

    let score = 0;
    if (haystack.includes(q)) score += 20;
    if (normalize(hit.title).startsWith(q)) score += 15;
    if (normalize(hit.title) === q) score += 30;

    let tokensMatched = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) {
        tokensMatched += 1;
        score += 4;
      }
    }
    if (tokensMatched === 0) continue;
    if (tokens.length > 1 && tokensMatched < tokens.length) {
      score -= (tokens.length - tokensMatched) * 2;
    }

    scored.push({ hit, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title))
    .slice(0, limit)
    .map((row) => row.hit);
}
