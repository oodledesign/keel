export type MarketingReadinessItemId =
  | 'cover'
  | 'summary'
  | 'key_points'
  | 'epc'
  | 'brochure_or_floorplan'
  | 'website_or_portal'
  | 'location'
  | 'acting_agent';

export type MarketingReadinessItem = {
  id: MarketingReadinessItemId;
  label: string;
  pass: boolean;
  hint: string;
  hrefTab?: 'marketing' | 'media' | 'management' | 'overview' | 'publishing';
};

export type MarketingReadiness = {
  items: MarketingReadinessItem[];
  passCount: number;
  total: number;
  ready: boolean;
};

const SUMMARY_MAX = 140;

type ReadinessListing = {
  summary: string | null;
  keyPoints: string[];
  epcBand: string | null;
  epcRating: number | null;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  coverUrl?: string | null;
  actingAgents?: unknown[] | null;
  brochureShareEnabled?: boolean;
  hasPdfBrochure?: boolean;
};

type ReadinessMedia = {
  mediaType: string;
  isCover?: boolean;
};

type ReadinessPublication = {
  status: string;
  portal?: string;
};

export function getMarketingReadiness(input: {
  listing: ReadinessListing;
  media?: ReadinessMedia[];
  publications?: ReadinessPublication[];
}): MarketingReadiness {
  const { listing } = input;
  const media = input.media ?? [];
  const publications = input.publications ?? [];

  const hasCover =
    Boolean(listing.coverUrl) ||
    media.some((m) => m.isCover) ||
    media.some((m) => m.mediaType === 'image');

  const summary = listing.summary?.trim() ?? '';
  const summaryOk = summary.length > 0 && summary.length <= SUMMARY_MAX;

  const keyPoints = (listing.keyPoints ?? []).filter(
    (p) => p.trim().length > 0,
  );
  const keyPointsOk = keyPoints.length >= 3;

  const hasEpcField =
    Boolean(listing.epcBand?.trim()) || listing.epcRating != null;
  const hasEpcMedia = media.some((m) => m.mediaType === 'epc');
  const epcOk = hasEpcField || hasEpcMedia;

  const brochureOrFloorplan =
    media.some(
      (m) => m.mediaType === 'brochure' || m.mediaType === 'floorplan',
    ) ||
    Boolean(listing.brochureShareEnabled) ||
    Boolean(listing.hasPdfBrochure);

  const hasWebsite = Boolean(listing.websiteUrl?.trim());
  const hasPublishedPortal = publications.some((p) => p.status === 'published');
  const websiteOrPortal = hasWebsite || hasPublishedPortal;

  const hasLocation = listing.latitude != null && listing.longitude != null;
  const hasAgent = (listing.actingAgents?.length ?? 0) > 0;

  const items: MarketingReadinessItem[] = [
    {
      id: 'cover',
      label: 'Cover photo',
      pass: hasCover,
      hint: 'Add a primary image on Media',
      hrefTab: 'media',
    },
    {
      id: 'summary',
      label: 'Summary (≤140 chars)',
      pass: summaryOk,
      hint:
        summary.length > SUMMARY_MAX
          ? 'Shorten the summary'
          : 'Add a marketing summary',
      hrefTab: 'marketing',
    },
    {
      id: 'key_points',
      label: 'At least 3 key points',
      pass: keyPointsOk,
      hint: `Add ${Math.max(0, 3 - keyPoints.length)} more key point(s)`,
      hrefTab: 'marketing',
    },
    {
      id: 'epc',
      label: 'EPC band/rating or certificate',
      pass: epcOk,
      hint: 'Set EPC on Edit or upload an EPC on Media',
      hrefTab: 'media',
    },
    {
      id: 'brochure_or_floorplan',
      label: 'Brochure or floor plan',
      pass: brochureOrFloorplan,
      hint: 'Upload a brochure on Media (for portals), enable online brochure share, or download a PDF',
      hrefTab: 'media',
    },
    {
      id: 'website_or_portal',
      label: 'Website URL or published portal',
      pass: websiteOrPortal,
      hint: 'Add a website URL or include this disposal on a live channel',
      hrefTab: 'publishing',
    },
    {
      id: 'location',
      label: 'Map coordinates',
      pass: hasLocation,
      hint: 'Add postcode/address and save to geocode, or set lat/lng',
      hrefTab: 'overview',
    },
    {
      id: 'acting_agent',
      label: 'Acting agent assigned',
      pass: hasAgent,
      hint: 'Assign an acting agent on Management',
      hrefTab: 'management',
    },
  ];

  const passCount = items.filter((i) => i.pass).length;
  return {
    items,
    passCount,
    total: items.length,
    ready: passCount === items.length,
  };
}
