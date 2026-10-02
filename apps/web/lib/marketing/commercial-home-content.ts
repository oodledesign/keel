import { commercialCta } from '~/config/commercial-cta.config';
import {
  COMMERCIAL_GRADUATED_TIERS,
  estimateMonthlyBreakdownGbp,
} from '~/lib/billing/commercial-graduated-pricing';
import type { MarketingScreenData } from '~/lib/marketing/marketing-screen';

/** Format integer GBP amounts for marketing displays (e.g. £89). */
function formatPounds(amount: number): string {
  return `£${amount}`;
}

export const COMMERCIAL_HOME_SEO = {
  title: 'Workspace for commercial property agents | Ozer',
  description:
    'Publish once to Rightmove Commercial, EACH and your website. Requirements and pipeline on one desk, from £89 a month.',
  keywords: [
    'commercial property CRM',
    'commercial property agent software UK',
    'commercial agency CRM',
    'disposals software',
    'requirements matching software',
    'Rightmove commercial CRM',
    'EACH feed CRM',
    'Property Hive CRM',
    'commercial agency pipeline',
  ],
} as const;

export const COMMERCIAL_HOME_HERO = {
  eyebrow: 'For UK commercial property agents',
  title: 'The workspace for commercial property agents.',
  body: 'Disposals, requirements and your pipeline on one desk. Publish once to Rightmove Commercial, EACH and your website.',
  microLine: 'From £89/mo · Portals included · Pricing published',
  formLabel: 'Work email',
  formPlaceholder: 'you@youragency.co.uk',
  signedInLabel: 'Open your workspace',
  portalsLabel: 'Publishes to',
} as const;

export const COMMERCIAL_HOME_HERO_SCREEN: MarketingScreenData = {
  src: '/brand/marketing/commercial-agency-desk.jpg',
  alt: 'Ozer agency home showing active instructions, applicant requirements, live portal feeds and the fee pipeline',
  width: 2400,
  height: 1228,
  annotations: [
    { x: 4.5, y: 20, label: 'Portal enquiries queue up for triage' },
    {
      x: 42.5,
      y: 20,
      label: 'Live stock goes to Rightmove Commercial, EACH and your site',
    },
    { x: 47, y: 76, label: 'Publish and update from one record' },
  ],
};

export const COMMERCIAL_HOME_PUBLISH_PORTALS = [
  {
    name: 'Rightmove Commercial',
    logoSrc: '/brand/integrations/rightmove.jpg',
  },
  { name: 'EACH', logoSrc: '/brand/integrations/each.png' },
  { name: 'Property Hive', logoSrc: '/brand/integrations/property-hive.png' },
] as const;

export type CommercialBeforeAfterRow = {
  before: string;
  withOzer: string;
};

export const COMMERCIAL_BEFORE_AFTER = {
  eyebrow: 'Sound familiar?',
  heading: 'Your desk, minus the busywork.',
  rows: [
    {
      before: 'Re-keying every disposal',
      withOzer: 'Publish once, everywhere',
    },
    {
      before: 'Requirements in inboxes and heads',
      withOzer: 'Every brief matched to stock',
    },
    {
      before: 'Mail-merging applicants by hand',
      withOzer: 'Applicants get it in their digest',
    },
    {
      before: 'A pipeline spreadsheet nobody trusts',
      withOzer: 'One board, fees by stage',
    },
  ] as CommercialBeforeAfterRow[],
} as const;

export const COMMERCIAL_SIX_JOBS_HEADING = {
  eyebrow: 'On the desk',
  title: 'Six jobs you stop doing by hand.',
} as const;

export type SixJobsPanelId =
  | 'portals'
  | 'requirements'
  | 'circulation'
  | 'pipeline'
  | 'brochures'
  | 'ai';

export interface SixJobsPanel {
  id: SixJobsPanelId;
  label: string;
  h3: string;
  oneLine: string;
  bullets: string[];
  bgStyle: {
    bg: string;
    text: string;
    mutedText: string;
    border: string;
    bulletDot: string;
  };
}

export const COMMERCIAL_SIX_JOBS_PANELS: SixJobsPanel[] = [
  {
    id: 'portals',
    label: 'Portals',
    h3: 'Type it in once.',
    oneLine: 'Live on Rightmove Commercial, EACH and your website.',
    bullets: [
      'Publish and update from one record',
      'Hide price or rent when confidential',
      'No re-keying, no CSV uploads',
    ],
    bgStyle: {
      bg: 'bg-[#FF5C34]',
      text: 'text-[#2A1720]',
      mutedText: 'text-[#4A2635]',
      border: 'border-[#2A1720]/20',
      bulletDot: 'bg-[#2A1720]',
    },
  },
  {
    id: 'requirements',
    label: 'Requirements',
    h3: 'Every brief, matched to stock.',
    oneLine: 'Scored by size, location, tenure and sector.',
    bullets: [
      'Interest schedule on every disposal',
      'Status and activity per party',
      'AI explains each match',
    ],
    bgStyle: {
      bg: 'bg-[#FBF6EC]',
      text: 'text-[#2A1720]',
      mutedText: 'text-[#5A4450]',
      border: 'border-[#2A1720]/15',
      bulletDot: 'bg-[#FF5C34]',
    },
  },
  {
    id: 'circulation',
    label: 'Circulation',
    h3: 'Send it to the right people.',
    oneLine: 'Applicants whose brief fits get new instructions automatically.',
    bullets: [
      'Matched applicants get it in their digest',
      'Nothing sent without a fit',
    ],
    bgStyle: {
      bg: 'bg-[#F7F9C8]',
      text: 'text-[#2A1720]',
      mutedText: 'text-[#504430]',
      border: 'border-[#2A1720]/15',
      bulletDot: 'bg-[#2A1720]',
    },
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    h3: 'Know where every fee stands.',
    oneLine: 'Instructions, under offers and completions on one board.',
    bullets: [
      'Drag between stages',
      'Fees totalled by stage',
      'Period insights for the board',
    ],
    bgStyle: {
      bg: 'bg-[#D7EFFF]',
      text: 'text-[#0C2438]',
      mutedText: 'text-[#284860]',
      border: 'border-[#0C2438]/15',
      bulletDot: 'bg-[#0C2438]',
    },
  },
  {
    id: 'brochures',
    label: 'Brochures',
    h3: 'Brochures, PDF or online.',
    oneLine:
      'Branded particulars and a shareable slideshow, from the same disposal.',
    bullets: [
      'PDF brochure for print and email',
      'Online slideshow with photos, floorplans and location',
      'Enquiry form wired back to you',
    ],
    bgStyle: {
      bg: 'bg-[#E4E8DC]',
      text: 'text-[#1F2B1A]',
      mutedText: 'text-[#3E4F38]',
      border: 'border-[#1F2B1A]/15',
      bulletDot: 'bg-[#1F2B1A]',
    },
  },
  {
    id: 'ai',
    label: 'AI',
    h3: 'AI drafts. You decide.',
    oneLine: 'Nothing is published or emailed until you say so.',
    bullets: [],
    bgStyle: {
      bg: 'bg-[#2A1720]',
      text: 'text-[#FBF6EC]',
      mutedText: 'text-[#C5B4BC]',
      border: 'border-[#FBF6EC]/15',
      bulletDot: 'bg-[#FF5C34]',
    },
  },
];

export const COMMERCIAL_AI_PILLS = [
  {
    bold: 'Marketing copy',
    line: 'First-pass particulars from the listing',
    accent: 'wasabi' as const,
  },
  {
    bold: 'Requirement drafts',
    line: 'A pasted email becomes a brief',
    accent: 'sage' as const,
  },
  {
    bold: 'Match explanations',
    line: 'Why it fits, in plain English',
    accent: 'wasabi' as const,
  },
  {
    bold: 'Interest triage',
    line: 'Work the shortlist first',
    accent: 'sage' as const,
  },
  {
    bold: 'Outreach drafts',
    line: 'A first email, ready to edit',
    accent: 'wasabi' as const,
  },
];

export function getCommercialPricingData() {
  const [tier1, tier2, tier3] = COMMERCIAL_GRADUATED_TIERS;
  const fourSeatsTotal = formatPounds(estimateMonthlyBreakdownGbp(4).totalGbp);

  return {
    eyebrow: 'Pricing',
    heading: 'One price. Published.',
    body: `${formatPounds(tier1!.unitGbp)} for seat 1, ${formatPounds(tier2!.unitGbp)} for seats 2–7, ${formatPounds(tier3!.unitGbp)} from seat 8. Portals included.`,
    bands: [
      { label: 'Seat 1', price: `${formatPounds(tier1!.unitGbp)}/mo` },
      { label: 'Seats 2–7', price: `${formatPounds(tier2!.unitGbp)}/mo each` },
      { label: 'Seats 8+', price: `${formatPounds(tier3!.unitGbp)}/mo each` },
    ],
    inclusions:
      'Portals, pipeline, matching, PDF and online brochures, and AI drafts in every seat.',
    supportLine:
      'Free support seats for admin and finance once you have two fee-earners.',
    exampleNote: `Typical 4-seat desk: ${fourSeatsTotal}/month.`,
  };
}

export interface CommercialTrustItem {
  title: string;
  href?: string;
}

export const COMMERCIAL_TRUST_STRIP: {
  items: CommercialTrustItem[];
  agencySlot: {
    enabled: boolean;
    text: string;
  };
} = {
  items: [
    { title: 'EU-hosted, UK-built', href: '/trust' },
    { title: 'DPA ready', href: '/dpa' },
    { title: 'Pricing on the page, not behind a demo', href: '#pricing' },
  ],
  agencySlot: {
    enabled: false,
    text: 'Built with a working commercial agency in Kent',
  },
};

export interface CommercialFaq {
  question: string;
  answer: string;
}

export function getCommercialHomeFaqs(): CommercialFaq[] {
  const [seat1, seats2to7, seats8plus] = COMMERCIAL_GRADUATED_TIERS;
  return [
    {
      question: 'What is the Commercial Property workspace?',
      answer:
        'A workspace built for UK commercial agency desks. Instructions, disposals, applicant requirements, matching, online and PDF brochures, pipeline and portal publishing all sit on one desk, with published seat pricing.',
    },
    {
      question: 'Which portals are included?',
      answer:
        'Rightmove Commercial via real-time data feed, EACH via an automated feed, and Property Hive for your WordPress site. All are included from the first billable seat with no bolt-on fees.',
    },
    {
      question: 'How does interest matching work?',
      answer:
        'Every requirement is scored against your stock by size, location, tenure and sector. When an instruction matches an applicant’s brief, it appears on the interest schedule and can be circulated automatically in their digest.',
    },
    {
      question: 'What does AI do on the desk?',
      answer:
        'AI drafts marketing particulars from listing facts, turns pasted emails into requirements, explains match scores and writes first-pass outreach. Nothing is ever sent or published without your approval.',
    },
    {
      question: 'How does pricing work?',
      answer: `Pricing is graduated: ${formatPounds(seat1!.unitGbp)}/month for seat 1, ${formatPounds(seats2to7!.unitGbp)}/month for seats 2–7, and ${formatPounds(seats8plus!.unitGbp)}/month from seat 8. Add or remove seats anytime. Support seats for admin and finance are free once you have two fee-earners.`,
    },
    {
      question: commercialCta.faqQuestion,
      answer: commercialCta.faqAnswer,
    },
  ];
}

export const COMMERCIAL_FINAL_CTA = {
  heading: 'Put your desk on Ozer.',
  body: 'From £89 a month. Portals included.',
} as const;
