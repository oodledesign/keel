import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  FileText,
  Home,
  MessageSquare,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';

import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import { formatGbp } from '~/lib/billing/billing-config-prices';
import {
  BUSINESS_GRADUATED_PLAN_ID,
  BUSINESS_GRADUATED_PRODUCT_ID,
  BUSINESS_GRADUATED_TIERS,
  estimateMonthlyGbp as estimateBusinessMonthlyGbp,
  formatGraduatedWorkedExample as formatBusinessGraduatedWorkedExample,
} from '~/lib/billing/business-graduated-pricing';
import {
  BUSINESS_STARTER_PLAN_ID,
  BUSINESS_STARTER_PRODUCT_ID,
  estimateStarterMonthlyGbp,
  formatStarterWorkedExample,
} from '~/lib/billing/business-starter-pricing';
import {
  COMMERCIAL_GRADUATED_PLAN_ID,
  COMMERCIAL_GRADUATED_PRODUCT_ID,
  COMMERCIAL_GRADUATED_TIERS,
  COMMERCIAL_ILLUSTRATIVE_TIERS,
  estimateMonthlyBreakdownGbp,
  formatGraduatedWorkedExample,
  freeSupportSeats,
} from '~/lib/billing/commercial-graduated-pricing';
import {
  MARKETING_FREE_TIER,
  MARKETING_WORKSPACE_PLANS,
  type MarketingWorkspacePlan,
} from '~/lib/billing/pricing-marketing';

export type SegmentSlug = 'personal' | 'work' | 'commercial-property';

export type SegmentFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type SegmentFaq = {
  question: string;
  answer: string;
};

export type SegmentPricingCard = {
  id?: string;
  name: string;
  description: string;
  priceGbp: number;
  priceLabel: string;
  /** How the big price reads — monthly total vs price-per-seat band. */
  priceUnit?: 'month' | 'seat' | 'additional_seat' | 'then_band';
  /** Unit suffix next to the big price (e.g. "/mo", "then for seats 2–7"). */
  priceUnitLabel?: string;
  /** Optional line under the big price (e.g. graduated band). */
  priceCaption?: string;
  /** Worked total from estimateMonthlyBreakdownGbp (Team/Scale cards). */
  priceExample?: string;
  /** Primary structural label for graduated ladder cards (e.g. "Seats 2–7"). */
  bandTitle?: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  signupProfile?: WorkspaceProfile;
  productId?: string;
  planId?: string;
  /** Prefill checkout quantity for graduated commercial pricing. */
  seats?: number;
  seatRangeLabel?: string;
};

export type SegmentTestimonial = {
  quote: string;
  name: string;
  role: string;
  firm: string;
};

export type SegmentIntegration = {
  name: string;
  /** Optional; landing UI shows logos only. */
  description?: string;
  /** Path under /public, e.g. /brand/integrations/rightmove.png */
  logoSrc?: string;
};

export type SegmentLandingConfig = {
  slug: SegmentSlug;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
  };
  stats: Array<{ value: string; label: string }>;
  features: SegmentFeature[];
  steps: Array<{ title: string; description: string }>;
  pricingPlans: SegmentPricingCard[];
  pricingNote: string;
  faqs: SegmentFaq[];
  relatedSegments: Array<{
    slug: SegmentSlug;
    label: string;
    description: string;
    icon: LucideIcon;
  }>;
  signupProfile?: WorkspaceProfile;
  integrations?: SegmentIntegration[];
  testimonials?: SegmentTestimonial[];
  /** Live public brochure URL for the commercial brochures section. */
  brochureExampleUrl?: string;
};

function planToCard(
  plan: MarketingWorkspacePlan,
  interval: 'month' | 'year' = 'month',
): SegmentPricingCard {
  const price =
    interval === 'year' ? plan.yearlyPriceGbp : plan.monthlyPriceGbp;
  const planId = interval === 'year' ? plan.yearlyPlanId : plan.monthlyPlanId;

  return {
    name: plan.name,
    description: plan.description,
    priceGbp: price,
    priceLabel:
      price === 0
        ? 'Free'
        : interval === 'year'
          ? `${price}/yr`
          : `${price}/mo`,
    features: [...plan.features],
    highlighted: plan.highlighted,
    badge: plan.badge,
    signupProfile: plan.profile,
    productId: plan.productId,
    planId,
  };
}

function freePersonalCard(): SegmentPricingCard {
  return {
    name: MARKETING_FREE_TIER.name,
    description: MARKETING_FREE_TIER.description,
    priceGbp: 0,
    priceLabel: 'Free',
    features: [...MARKETING_FREE_TIER.features],
    signupProfile: 'family',
  };
}

const LAUNCH_SEGMENTS: SegmentSlug[] = ['personal', 'work'];

const SEGMENT_ICONS: Record<SegmentSlug, LucideIcon> = {
  personal: Home,
  work: Briefcase,
  'commercial-property': Building2,
};

function relatedExcept(current: SegmentSlug) {
  const map: Record<
    'personal' | 'work',
    { label: string; description: string }
  > = {
    personal: {
      label: 'Personal & family',
      description: 'Free hub — tasks and planner across every workspace.',
    },
    work: {
      label: 'Business workspace',
      description: 'Clients, jobs, and invoices inside the Workspace OS.',
    },
  };

  return LAUNCH_SEGMENTS.filter((slug) => slug !== current).map((slug) => ({
    slug,
    icon: SEGMENT_ICONS[slug],
    ...map[slug as 'personal' | 'work'],
  }));
}

function businessPricingCards(): SegmentPricingCard[] {
  const starter = MARKETING_WORKSPACE_PLANS.find(
    (plan) => plan.productId === BUSINESS_STARTER_PRODUCT_ID,
  );
  const pro = MARKETING_WORKSPACE_PLANS.find(
    (plan) => plan.productId === BUSINESS_GRADUATED_PRODUCT_ID,
  );

  return [
    ...MARKETING_WORKSPACE_PLANS.filter(
      (plan) => plan.productId === 'ozer-business-lite',
    ).map((plan) => planToCard(plan)),
    {
      name: starter?.name ?? 'Starter',
      description:
        starter?.description ??
        'Clients, projects, and invoices — £14 for seat 1, then £9 for every extra seat',
      priceGbp: estimateStarterMonthlyGbp(1),
      priceLabel: `${formatGbp(estimateStarterMonthlyGbp(1))}/mo`,
      priceExample: formatStarterWorkedExample(4, formatGbp),
      features: starter?.features ?? [],
      signupProfile: 'work_design',
      productId: BUSINESS_STARTER_PRODUCT_ID,
      planId: starter?.monthlyPlanId ?? BUSINESS_STARTER_PLAN_ID,
      seats: 1,
    },
    {
      name: pro?.name ?? 'Pro',
      description:
        pro?.description ??
        'Graduated seats for studios — £29 for seat 1, then £22 for every extra seat',
      priceGbp: estimateBusinessMonthlyGbp(1),
      priceLabel: `${formatGbp(estimateBusinessMonthlyGbp(1))}/mo`,
      priceExample: formatBusinessGraduatedWorkedExample(4, formatGbp),
      features: pro?.features ?? [],
      highlighted: true,
      badge: 'Popular',
      signupProfile: 'work_design',
      productId: BUSINESS_GRADUATED_PRODUCT_ID,
      planId: pro?.monthlyPlanId ?? BUSINESS_GRADUATED_PLAN_ID,
      seats: 1,
    },
  ];
}

function commercialPricingCards(): SegmentPricingCard[] {
  const unitGbpForSeats = (seats: number) =>
    estimateMonthlyBreakdownGbp(seats).lines.at(-1)?.unitGbp ??
    COMMERCIAL_GRADUATED_TIERS[0]!.unitGbp;

  const [seat1, seats2to7, seats8plus] = COMMERCIAL_GRADUATED_TIERS;

  const soloFeatures = [
    'Disposals, units & marketing',
    'Pipeline (instructions & requirements)',
    'Interest matching',
    'Online brochures & branded decks',
    'AI drafts for copy & requirements',
    'Rightmove, EACH & Property Hive WP',
  ];

  return COMMERCIAL_ILLUSTRATIVE_TIERS.map((tier) => {
    const support = freeSupportSeats(tier.billableSeats);
    const isSolo = tier.id === 'solo';
    const unitGbp = unitGbpForSeats(tier.billableSeats);

    const features = isSolo
      ? soloFeatures
      : [
          'Everything in Commercial Solo, plus…',
          support > 0
            ? `${support} free support seats`
            : 'Additional billable capacity',
          'Multi-branch offices',
        ];

    const thenLabel =
      tier.id === 'team'
        ? `for ${seats2to7!.bandLabel.toLowerCase()}`
        : tier.id === 'scale'
          ? `for ${seats8plus!.bandLabel.toLowerCase()}`
          : '/mo';

    return {
      id: tier.id,
      name: tier.label,
      bandTitle: tier.bandTitle,
      description: tier.description,
      priceGbp: unitGbp,
      priceUnit: isSolo ? 'month' : 'then_band',
      priceUnitLabel: isSolo ? '/mo' : thenLabel,
      priceLabel: isSolo
        ? `${formatGbp(unitGbp)}/mo`
        : `then ${formatGbp(unitGbp)} ${thenLabel}`,
      priceCaption: isSolo
        ? '1 billable seat · portals included'
        : `Continues from seat 1 at ${formatGbp(seat1!.unitGbp)}/mo`,
      priceExample: isSolo
        ? undefined
        : formatGraduatedWorkedExample(tier.billableSeats, formatGbp),
      seats: tier.billableSeats,
      seatRangeLabel: tier.seatRangeLabel,
      highlighted: tier.highlighted,
      badge: tier.highlighted ? 'Most desks' : undefined,
      signupProfile: 'commercial_property',
      productId: COMMERCIAL_GRADUATED_PRODUCT_ID,
      planId: COMMERCIAL_GRADUATED_PLAN_ID,
      features,
    };
  });
}

export const SEGMENT_LANDING_PAGES: Record<SegmentSlug, SegmentLandingConfig> =
  {
    personal: {
      slug: 'personal',
      seo: {
        title: 'Free hub for every workspace — Ozer',
        description:
          'Free personal home connects tasks and planner across business, family, property, and community. One Workspace OS. No card required.',
        keywords: [
          'workspace OS',
          'personal workspace hub',
          'unified task manager',
          'family task manager',
          'free planner app',
          'household organisation software',
        ],
      },
      hero: {
        eyebrow: 'Personal & family — free hub',
        title: 'One free home for',
        titleAccent: 'life and every workspace',
        subtitle:
          'Ozer is a Workspace OS, not a siloed CRM. Your personal home shows tasks and today across business, family, and community — while personal and family stay free.',
      },
      stats: [
        { value: '£0', label: 'Forever — personal & family' },
        { value: '1 hub', label: 'All workspaces connected' },
        { value: 'No card', label: 'Start free in minutes' },
      ],
      features: [
        {
          icon: ClipboardList,
          title: 'Tasks across every workspace',
          description:
            'Work, family, and personal tasks in one list from your free home — filter by workspace when you need focus.',
        },
        {
          icon: Calendar,
          title: 'Planner and today',
          description:
            'Today pulls open tasks and calendar from every space you belong to.',
        },
        {
          icon: Home,
          title: 'Workspace overview',
          description:
            'Open tasks and next events per workspace, then jump in. Pin any page to shortcuts.',
        },
        {
          icon: Users,
          title: 'People and relationships',
          description:
            'Context for friends, family, and collaborators — follow-ups and notes in one timeline.',
        },
        {
          icon: ShoppingCart,
          title: 'Family calendar and routines',
          description:
            'Schedules, school events, meals, and shopping in a family workspace — still visible from personal home.',
        },
      ],
      steps: [
        {
          title: 'Start free',
          description: 'No card. No trial clock on personal use.',
        },
        {
          title: 'Add your spaces',
          description:
            'Begin with personal home, then plug in family, business, or community — all stay connected.',
        },
        {
          title: 'Invite family',
          description:
            'Share calendars and lists. Members join free — only owners bill paid workspaces.',
        },
      ],
      pricingPlans: [freePersonalCard()],
      pricingNote:
        'Personal and family stay free. You pay only when you add community, business, or property — and one workspace price covers the team, not a per-seat tax.',
      faqs: [
        {
          question: 'Is Ozer really free for personal use?',
          answer:
            'Yes. Personal home and one family workspace are free with no time limit. You pay only for paid workspace types such as business, property, or community.',
        },
        {
          question: 'Can my partner and children use Ozer?',
          answer:
            'Yes. Invite them to the family workspace. Shared calendars, tasks, meals, and lists — no separate subscription per person.',
        },
        {
          question: 'How is Ozer different from a to-do app or CRM?',
          answer:
            'Most CRMs only handle work. Ozer is a Workspace OS: free personal home connects tasks, planner, and today across every workspace. Business tools live in the same account.',
        },
        {
          question: 'Can I see work tasks from personal home?',
          answer:
            'Yes by default. Turn workspace tasks off in settings when you want personal-only focus.',
        },
        {
          question: 'Can I freelance on the free plan?',
          answer:
            'Personal is for life organisation. For clients, invoices, and jobs, add a business workspace — free Business Lite or a 14-day Solo trial.',
        },
      ],
      relatedSegments: relatedExcept('personal'),
      signupProfile: 'family',
    },

    work: {
      slug: 'work',
      seo: {
        title: 'Business CRM in Workspace OS — Ozer',
        description:
          'Clients, jobs, invoices, activity tracking, and pipeline in a business workspace linked to free personal home. Flat price for the whole team from £0–£29 per month.',
        keywords: [
          'workspace OS for business',
          'small business CRM UK',
          'agency project management',
          'freelance CRM UK',
          'studio client management',
        ],
      },
      hero: {
        eyebrow: 'Business workspace',
        title: 'Run the studio without',
        titleAccent: 'seven tools and Zapier',
        subtitle:
          'Ozer’s business workspace answers “where do clients, jobs, and invoices live?” Pipeline, delivery, billing, activity tracking, and portals in one workspace — while personal home still sees today’s tasks. One account. One price for the team.',
      },
      stats: [
        { value: '£0', label: 'Business Lite — apps and team' },
        { value: '1 login', label: 'Personal and business together' },
        { value: 'Team price', label: 'Not a per-seat tax' },
      ],
      features: [
        {
          icon: Home,
          title: 'Business inside the Workspace OS',
          description:
            'Unlike siloed CRMs, business plugs into your free personal home — tasks, today, and planner across work and life.',
        },
        {
          icon: Users,
          title: 'Clients and pipeline',
          description:
            'Track leads and live clients with full context on the record.',
        },
        {
          icon: ClipboardList,
          title: 'Jobs and projects',
          description:
            'Plan work, assign people, attach notes and files, and message on the job.',
        },
        {
          icon: Activity,
          title: 'Activity tracking',
          description:
            'Ozer Assistant captures app and website sessions on your Mac. Review by day, group by domain, and assign blocks to clients and projects.',
        },
        {
          icon: FileText,
          title: 'Invoices, proposals, contracts',
          description:
            'Send documents, collect signatures, and keep money on the client and job.',
        },
        {
          icon: MessageSquare,
          title: 'Team and client messaging',
          description:
            'Threads for team and clients, with files clients are allowed to see — not personal WhatsApp.',
        },
        {
          icon: Building2,
          title: 'Client portal',
          description:
            'Branded space for proposals, invoices, tickets, and shared documents.',
        },
        {
          icon: Wallet,
          title: 'Finances and SOPs',
          description:
            'Income and costs next to the work. Playbooks your team actually runs.',
        },
      ],
      steps: [
        {
          title: 'Start free or trial',
          description:
            'Business Lite at £0 for apps and team settings, or a 14-day trial on graduated Business seats.',
        },
        {
          title: 'Add clients and jobs',
          description:
            'Open jobs, attach notes and files — ready for day-to-day delivery.',
        },
        {
          title: 'Invite team and clients',
          description:
            'Staff and contractors take paid seats; project guests and client portals are included.',
        },
      ],
      pricingPlans: businessPricingCards(),
      pricingNote: (() => {
        const [seat1, extraSeats] = BUSINESS_GRADUATED_TIERS;
        return `Three public products: Free, Starter, and Pro. Starter is £14 for seat 1 then £9 for every extra seat. Pro is ${formatGbp(seat1!.unitGbp)} for seat 1 then ${formatGbp(extraSeats!.unitGbp)} for every extra seat. 1 / 4 / 10 seat figures are examples on those products — not separate SKUs.`;
      })(),
      faqs: [
        {
          question: 'How is Ozer different from other CRMs?',
          answer:
            'Most CRMs silo work from the rest of life. Ozer is a Workspace OS: business connects to a free personal home where tasks, planner, and today span every workspace. One login. Data stays in the EU.',
        },
        {
          question: 'Can I plan across business and personal tasks?',
          answer:
            'Yes. Planner and Today pull from workspaces you enable. Client work and personal errands in one day — then push blocks to Google Calendar if you want.',
        },
        {
          question: 'What is Free vs Starter vs Pro?',
          answer:
            'Free (Business Lite) is apps-only. Starter unlocks clients, projects, and invoices from £14, then £9 per extra seat. Pro adds shared AI that scales, 3 project guests per seat, and unlimited sharing with other paid workspaces.',
        },
        {
          question: 'Do clients pay for Ozer?',
          answer:
            'No. Portal and message access are free for clients — unlimited portal contacts. Billing stays with the workspace owner.',
        },
        {
          question: 'Can contractors work without seeing finances?',
          answer:
            'Yes. Contractors are paid seats with roles limited to assigned jobs and tasks without admin or billing. Project guests are narrower still — one project board, no seat cost.',
        },
        {
          question: 'Is there a free trial?',
          answer:
            'Paid Business includes a 14-day trial on your first paid workspace — no credit card required. Business Lite remains free forever.',
        },
      ],
      relatedSegments: relatedExcept('work'),
      signupProfile: 'work_design',
    },

    'commercial-property': {
      slug: 'commercial-property',
      seo: {
        title: 'Commercial Property workspace for UK agencies — Ozer',
        description:
          'CRM for commercial desks: disposals, pipeline, requirements, interest, online brochures, AI drafts, and portals (Rightmove, EACH, Property Hive). From £89/mo.',
        keywords: [
          'commercial property CRM UK',
          'commercial agency software',
          'agency pipeline board',
          'commercial instructions software',
          'Rightmove commercial CRM',
          'EACH property CRM',
          'Property Hive CRM',
        ],
      },
      hero: {
        eyebrow: 'Commercial Property workspace',
        title: 'Run the commercial desk',
        titleAccent: 'in one workspace',
        subtitle:
          'Disposals, pipeline, requirements, and interest — built for UK commercial agencies. Portals included from Solo. Published graduated pricing, no demo gate.',
      },
      stats: [
        { value: '£89', label: 'Seat 1 / month' },
        { value: '£55', label: 'Seats 2–7 each' },
        { value: '£39', label: 'Seats 8+ each' },
      ],
      features: [
        {
          icon: Building2,
          title: 'Disposals and marketing',
          description:
            'Listings with units, media, enquiries, brochure links, and Property Hive WordPress sync.',
        },
        {
          icon: ClipboardList,
          title: 'Commercial pipeline',
          description:
            'Instructions and requirements on one board. Drag stages, attach tasks and notes, keep fee-earners aligned.',
        },
        {
          icon: Users,
          title: 'Interest schedule',
          description:
            'Match interested parties between disposals and requirements with activity timestamps and status.',
        },
        {
          icon: Activity,
          title: 'AI on the commercial desk',
          description:
            'Marketing copy, requirement drafts, match explanations, triage, and outreach — always review before anything is saved.',
        },
        {
          icon: FileText,
          title: 'Portal publishing included',
          description:
            'Rightmove Commercial, EACH, and Property Hive WordPress — available from Commercial Solo.',
        },
        {
          icon: Wallet,
          title: 'Brochures & presentations',
          description:
            'Shareable online brochures and branded decks agents can send instead of static PDF dumps.',
        },
      ],
      steps: [
        {
          title: 'Pick your seats',
          description:
            'Use the calculator — graduated pricing is public. No “book a demo to hear the price.”',
        },
        {
          title: 'Bring the pipeline across',
          description:
            'Instructions, requirements, and disposals in one commercial workspace.',
        },
        {
          title: 'Invite fee-earners and support',
          description:
            'Billable seats run the desk. Free support seats handle notes, contacts, and visibility.',
        },
      ],
      pricingPlans: commercialPricingCards(),
      pricingNote: (() => {
        const [seat1, seats2to7, seats8plus] = COMMERCIAL_GRADUATED_TIERS;
        return `One graduated price for every agency: ${formatGbp(seat1!.unitGbp)} for seat 1, then ${formatGbp(seats2to7!.unitGbp)} for seats 2–7, then ${formatGbp(seats8plus!.unitGbp)} for seats 8+. Solo / Team / Scale describe those bands — not separate products.`;
      })(),
      integrations: [
        {
          name: 'Rightmove',
          logoSrc: '/brand/integrations/rightmove.jpg',
        },
        {
          name: 'EACH',
          logoSrc: '/brand/integrations/each.png',
        },
        {
          name: 'Property Hive',
          logoSrc: '/brand/integrations/property-hive.png',
        },
      ],
      faqs: [
        {
          question: 'What is the Commercial Property workspace?',
          answer:
            'A workspace for UK commercial agency desks — not a landlord portfolio tool. Disposals and marketing, a pipeline for instructions and requirements, interest matching, online brochures, AI drafts, and portal publishing sit on one desk, with published seat pricing.',
        },
        {
          question: 'How does graduated pricing work?',
          answer: (() => {
            const [seat1, seats2to7, seats8plus] = COMMERCIAL_GRADUATED_TIERS;
            const fourSeatTotal = formatGbp(
              estimateMonthlyBreakdownGbp(4).totalGbp,
            );
            return `One price for every agency: ${formatGbp(seat1!.unitGbp)} for seat 1, then ${formatGbp(seats2to7!.unitGbp)} for seats 2–7, then ${formatGbp(seats8plus!.unitGbp)} for seats 8+. Solo / Team / Scale describe those bands — not separate products. Four billable seats is ${formatGbp(seat1!.unitGbp)} + 3 × ${formatGbp(seats2to7!.unitGbp)} = ${fourSeatTotal}/mo. Use the calculator on this page; there is no demo gate to hear the number.`;
          })(),
        },
        {
          question: 'Can I add seats later?',
          answer:
            'Yes. You stay on the same graduated price. Adding a billable seat can only raise the monthly total — you do not switch products. Support-seat allowance also steps up with headcount (none on Solo, 2 from the second billable seat, 4 from the eighth).',
        },
        {
          question: 'Is there a free trial?',
          answer:
            'Yes. Commercial Property includes a 14-day trial on your first paid workspace — no credit card required to start. Cancel from account settings; you keep access through the period you have already paid for.',
        },
        {
          question: 'What are support seats?',
          answer:
            'Free seats for admin and finance: they can view records, add notes, and log activity, but cannot move pipeline stages, edit disposals, or publish to portals. Solo (1 billable seat) has none; desks with 2–7 billable seats get 2; 8+ billable seats get 4.',
        },
        {
          question: 'Which portals are included?',
          answer:
            'Rightmove Commercial, EACH, and Property Hive WordPress — included from seat 1. Publish commercial stock via Rightmove’s Commercial Listings API, a dedicated EACH XML feed, and a Property Hive XML import so the agency site stays in sync.',
        },
        {
          question: 'What does AI do on the desk?',
          answer:
            'It drafts where the desk loses time: disposal marketing copy, requirement briefs from an enquiry or pasted email, match explanations, add/skip/review triage, and a first outreach email. Every draft stays reviewable — nothing is saved, published, or sent until you confirm.',
        },
        {
          question: 'How do online brochures work?',
          answer:
            'Each disposal can share a branded slideshow — photos, key facts, floorplans, location, and an enquire form — instead of emailing another static PDF. Agency colours and logo come through automatically, and enquiries route back to the acting agents.',
        },
        {
          question: 'How does interest matching work?',
          answer:
            'The desk scores disposals against requirements (size, location, tenure, sector) and suggests pairs on the interest schedule. You can add a match in one click, and AI can explain why a pair fits or triage the shortlist — still with a human confirm before anything is saved.',
        },
      ],
      relatedSegments: [],
      signupProfile: 'commercial_property',
      // Live public brochure example for the brochures section.
      brochureExampleUrl:
        'https://app.ozer.so/share/brochure/fd02546873794bdf06b70864efdc7ba91c9d34243a50d07d',
    },
  };

export function getSegmentLandingConfig(
  slug: string,
): SegmentLandingConfig | null {
  if (slug in SEGMENT_LANDING_PAGES) {
    return SEGMENT_LANDING_PAGES[slug as SegmentSlug];
  }
  return null;
}

const WORKSPACE_NAV_PATHS: Record<'personal' | 'work', string> = {
  personal: '/personal',
  work: '/work',
};

const WORKSPACE_NAV_LABELS: Record<'personal' | 'work', string> = {
  personal: 'Personal',
  work: 'Business',
};

const WORKSPACE_NAV_DESCRIPTIONS: Record<'personal' | 'work', string> = {
  personal: 'Free hub — tasks and planner connected across every workspace.',
  work: 'Clients, projects, invoices, and pipeline for freelancers and studios.',
};

export function getMarketingWorkspaceNavLinks() {
  return LAUNCH_SEGMENTS.map((slug) => ({
    slug,
    label: WORKSPACE_NAV_LABELS[slug as 'personal' | 'work'],
    path: WORKSPACE_NAV_PATHS[slug as 'personal' | 'work'],
    description: WORKSPACE_NAV_DESCRIPTIONS[slug as 'personal' | 'work'],
    icon: SEGMENT_ICONS[slug],
  }));
}

export function isWorkspaceNavPath(pathname: string) {
  return getMarketingWorkspaceNavLinks().some(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
}
