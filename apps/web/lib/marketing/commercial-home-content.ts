import type { FeatureTourBlock } from '~/lib/marketing/feature-tour-content';

export const COMMERCIAL_HOME_SEO = {
  title: 'The workspace for commercial property agents — Ozer',
  description:
    'Disposals, requirements, matching, circulation, pipeline and WIP on one desk — with Rightmove Commercial, EACH and Property Hive publishing included from seat 1. Join the waiting list.',
  keywords: [
    'commercial property CRM',
    'commercial property agent software UK',
    'commercial agency CRM',
    'disposals software',
    'requirements matching software',
    'Rightmove commercial CRM',
    'EACH feed CRM',
    'Property Hive CRM',
    'commercial agency WIP',
  ],
} as const;

export const COMMERCIAL_HOME_HERO = {
  eyebrow: 'For UK commercial property agents',
  title: 'The workspace for',
  titleAccent: 'commercial property agents',
  subtitle:
    'Disposals, requirements, matching, circulation and your WIP on one desk. Publish to Rightmove Commercial, EACH and Property Hive in one click — included from seat 1.',
  formLabel: 'Work email',
  formPlaceholder: 'you@youragency.co.uk',
  submitLabel: 'Join the waiting list',
  reassurance: 'We onboard agencies one desk at a time. No spam, no sequence.',
  signedInLabel: 'Open your workspace',
} as const;

export const COMMERCIAL_HOME_PUBLISH_PORTALS = [
  {
    name: 'Rightmove Commercial',
    logoSrc: '/brand/integrations/rightmove.jpg',
  },
  { name: 'EACH', logoSrc: '/brand/integrations/each.png' },
  { name: 'Property Hive', logoSrc: '/brand/integrations/property-hive.png' },
] as const;

export type CommercialPainFix = {
  pain: string;
  fix: string;
};

export const COMMERCIAL_HOME_PAIN_FIX: CommercialPainFix[] = [
  {
    pain: 'Re-keying the same disposal into every portal and the agency site.',
    fix: 'Publish once to Rightmove Commercial, EACH and Property Hive — status changes follow automatically.',
  },
  {
    pain: 'Requirements living in inboxes, notebooks and one negotiator’s head.',
    fix: 'Every requirement on the desk, scored against stock by size, location, tenure and sector.',
  },
  {
    pain: 'Mail-merging new instructions to applicants by hand.',
    fix: 'Put a disposal live and matching applicants get it in their digest — no spreadsheet export.',
  },
  {
    pain: 'A WIP spreadsheet nobody trusts by month end.',
    fix: 'Instructions, under offers and completions on one pipeline, with fees rolling up as deals move.',
  },
];

export const COMMERCIAL_TOUR_HEADING = {
  eyebrow: 'A closer look',
  title: 'What a day on the desk feels like.',
  intro:
    'Scroll through the commercial workspace — portals, requirements, circulation, pipeline, brochures and AI that knows your stock.',
} as const;

export const COMMERCIAL_FEATURE_TOUR_BLOCKS: FeatureTourBlock[] = [
  {
    id: 'commercial-portal-publishing',
    accent: 'coral',
    icon: 'Send',
    eyebrow: 'Portal publishing',
    title: 'Publish a disposal everywhere, once.',
    moment:
      'A new instruction lands on Monday. By lunch it is live on Rightmove Commercial, EACH and your own website — and you only typed it in once.',
    desc: 'Rightmove Commercial via the Listings API, a dedicated EACH XML feed and a Property Hive import for the agency site. Included from seat 1, not a bolt-on.',
    highlights: [
      'Rightmove Commercial, EACH and Property Hive included',
      'Under offer and let or sold statuses flow through',
      'Hide rent or price per disposal when it is confidential',
      'No per-portal re-keying or CSV uploads',
    ],
    mock: 'publish-portals',
  },
  {
    id: 'commercial-requirements-matching',
    accent: 'cool-blue',
    icon: 'ListFilter',
    eyebrow: 'Requirements & matching',
    title: 'Every applicant’s brief, matched against your stock.',
    moment:
      'A retailer emails asking for 2,000 sq ft in the town centre. Before you have finished reading, the desk has three disposals that fit.',
    desc: 'Requirements sit next to disposals, scored by size, location, tenure and sector. Add a match to the interest schedule in one click.',
    highlights: [
      'Fit score for every disposal and requirement pair',
      'Interest schedule with activity and status',
      'AI can explain a match or triage the shortlist',
      'Nothing saved until a person confirms',
    ],
    mock: 'requirements-match',
  },
  {
    id: 'commercial-circulation',
    accent: 'sage',
    icon: 'Mail',
    eyebrow: 'Circulation',
    title: 'New stock reaches the right applicants without a mail-merge.',
    moment:
      'You put a unit live and walk into a viewing. Applicants whose requirements fit already have it in their inbox.',
    desc: 'Going live triggers a match digest to the applicants it fits. Unsubscribes and delivery are handled for you.',
    highlights: [
      'Matched digests sent when stock goes live',
      'Only applicants whose brief actually fits',
      'One-click unsubscribe on every email',
      'No exporting lists into another tool',
    ],
    mock: 'circulation',
  },
  {
    id: 'commercial-pipeline-wip',
    accent: 'lime',
    icon: 'Kanban',
    eyebrow: 'Pipeline & WIP',
    title: 'Month-end WIP without the spreadsheet.',
    moment:
      'The partners ask where the quarter will land. You open the pipeline instead of chasing four negotiators for their numbers.',
    desc: 'Instructions and requirements on one board, from potential through to completed, with fees rolling up by stage.',
    highlights: [
      'Drag deals through potential, under offer and completed',
      'Fee totals roll up as stages change',
      'Tasks and notes attached to every deal',
      'Fallen-through deals stay visible, not deleted',
    ],
    mock: 'disposals-pipeline',
  },
  {
    id: 'commercial-brochures',
    accent: 'plum',
    icon: 'FileText',
    eyebrow: 'Online brochures',
    title: 'Send a brochure that looks like your agency, not a PDF dump.',
    moment:
      'An applicant asks for particulars. You send a link — photos, key facts, floorplans and an enquire button, in your colours.',
    desc: 'Every disposal gets a branded online brochure. Enquiries route straight back to the acting agents.',
    highlights: [
      'Photos, key facts, floorplans and location',
      'Agency logo and colours applied automatically',
      'Enquire form routed to the acting agents',
      'Always the latest version — no stale attachments',
    ],
    mock: 'brochure',
  },
  {
    id: 'commercial-ask-ai',
    accent: 'coral',
    icon: 'Sparkles',
    eyebrow: 'AI on the desk',
    title: 'Ask your desk a question. Get a LinkedIn post back.',
    moment:
      '“Write a LinkedIn post about last month’s lettings.” Thirty seconds later there is a draft built from what you actually did.',
    desc: 'Marketing copy, requirement drafts, match explanations and activity round-ups, grounded in your own disposals. Every draft is yours to edit before anything goes out.',
    highlights: [
      'LinkedIn and blog drafts from real desk activity',
      'Compare this September with last September',
      'Only uses publicly marketed details',
      'Nothing is posted or sent without you',
    ],
    mock: 'ask-ai',
  },
];

export type CommercialTrustItem = {
  icon: string;
  title: string;
  description: string;
  href?: string;
};

export const COMMERCIAL_HOME_TRUST: CommercialTrustItem[] = [
  {
    icon: 'ShieldCheck',
    title: 'EU-hosted, UK-built',
    description:
      'Your data sits on AWS in EU West, behind row-level security on every table.',
    href: '/trust',
  },
  {
    icon: 'FileCheck',
    title: 'DPA ready',
    description:
      'A data processing agreement you can hand straight to compliance.',
    href: '/dpa',
  },
  {
    icon: 'Users',
    title: 'Free support seats',
    description:
      'Admin and finance get free seats once your desk has two or more fee-earners.',
  },
  {
    icon: 'BadgePoundSterling',
    title: 'Published pricing',
    description:
      'The price is on the page. No “book a demo to hear the number”.',
    href: '/pricing',
  },
];

export type CommercialWorkspaceStripItem = {
  label: string;
  description: string;
  status: 'live' | 'free' | 'soon';
  href?: string;
};

export const COMMERCIAL_HOME_WORKSPACES: CommercialWorkspaceStripItem[] = [
  {
    label: 'Commercial Property',
    description: 'Disposals, requirements, pipeline and portals.',
    status: 'live',
    href: '/commercial-property',
  },
  {
    label: 'Business',
    description: 'Clients, projects, invoices and pipeline for studios.',
    status: 'live',
    href: '/work',
  },
  {
    label: 'Personal',
    description: 'Tasks and planner connected across every workspace.',
    status: 'free',
    href: '/personal',
  },
  {
    label: 'Surveyors',
    description: 'Instructions, inspections and reports.',
    status: 'soon',
  },
];

export const COMMERCIAL_HOME_FINAL_CTA = {
  title: 'Get your desk on the list.',
  subtitle:
    'We are bringing commercial agencies on in small groups so every desk gets set up properly. Leave your email and we will be in touch personally.',
  signedInTitle: 'Your desk is waiting.',
  signedInSubtitle:
    'Pick up where you left off — disposals, requirements and your pipeline are one click away.',
} as const;

export type CommercialProof = {
  quote: string;
  name: string;
  role: string;
  agency: string;
  logoSrc?: string;
};

/** Stays `null` until a customer has signed off a real quote. */
export const COMMERCIAL_HOME_PROOF: CommercialProof | null = null;

export const COMMERCIAL_HOME_WAITLIST_FAQ = {
  question: 'What happens when I join the waiting list?',
  answer:
    'We email you personally to set up your workspace — no automated sequence. If you would rather start straight away, pricing is published and you can sign up today.',
} as const;

/** Commercial FAQs repeated on the homepage, in display order. */
export const COMMERCIAL_HOME_FAQ_QUESTIONS = [
  'What is the Commercial Property workspace?',
  'Which portals are included?',
  'How does interest matching work?',
  'What does AI do on the desk?',
  'How does graduated pricing work?',
  'What are support seats?',
] as const;
