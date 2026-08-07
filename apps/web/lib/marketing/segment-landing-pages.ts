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
import {
  COMMERCIAL_GRADUATED_PLAN_ID,
  COMMERCIAL_GRADUATED_PRODUCT_ID,
  COMMERCIAL_ILLUSTRATIVE_TIERS,
  estimateMonthlyGbp,
  freeSupportSeats,
  portalPublishingAllowed,
} from '~/lib/billing/commercial-graduated-pricing';
import {
  MARKETING_FREE_TIER,
  MARKETING_WORKSPACE_PLANS,
  type MarketingWorkspacePlan,
} from '~/lib/billing/pricing-marketing';
import { formatGbp } from '~/lib/billing/billing-config-prices';

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
  name: string;
  description: string;
  priceGbp: number;
  priceLabel: string;
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

function commercialPricingCards(): SegmentPricingCard[] {
  return COMMERCIAL_ILLUSTRATIVE_TIERS.map((tier) => {
    const price = estimateMonthlyGbp(tier.billableSeats);
    const support = freeSupportSeats(tier.billableSeats);
    const portals = portalPublishingAllowed(tier.billableSeats);

    return {
      name: tier.label,
      description: tier.description,
      priceGbp: price,
      priceLabel: `${formatGbp(price)}/mo`,
      seats: tier.billableSeats,
      seatRangeLabel: tier.seatRangeLabel,
      highlighted: tier.highlighted,
      badge: tier.highlighted ? 'Most teams' : undefined,
      signupProfile: 'commercial_property',
      productId: COMMERCIAL_GRADUATED_PRODUCT_ID,
      planId: COMMERCIAL_GRADUATED_PLAN_ID,
      features: [
        tier.seatRangeLabel,
        `Illustrative example at ${tier.billableSeats} seat${tier.billableSeats === 1 ? '' : 's'}`,
        support > 0
          ? `${support} free support seats`
          : 'No free support seats on Solo',
        portals
          ? 'Portal publishing included'
          : 'Portal publishing from 2 seats',
        'WIP, disposals & requirements',
        'Property Hive website sync',
      ],
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
            'Business Lite at £0 for apps and team settings, or a 14-day trial on Solo, Team, or Scale.',
        },
        {
          title: 'Add clients and jobs',
          description:
            'Open jobs, attach notes and files — ready for day-to-day delivery.',
        },
        {
          title: 'Invite team and clients',
          description:
            'Staff join the workspace; clients get portal access when you share work.',
        },
      ],
      pricingPlans: MARKETING_WORKSPACE_PLANS.filter(
        (p) => p.profile === 'work_design',
      ).map((p) => planToCard(p)),
      pricingNote:
        'Signatures uses flat mailbox tiers from £9/mo on each workspace. Annual billing is 16.7% less than paying monthly for twelve months. One workspace price covers the team.',
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
          question: 'What is Business Lite vs Solo?',
          answer:
            'Business Lite is free: apps marketplace, team settings, brand basics — good if you mainly want add-ons. Solo adds full CRM: clients, jobs, invoices, pipeline, messages, SOPs for one person.',
        },
        {
          question: 'Do clients pay for Ozer?',
          answer:
            'No. Portal and message access are free for clients. Billing stays with the workspace owner.',
        },
        {
          question: 'Can contractors work without seeing finances?',
          answer:
            'Yes. Roles limit contractors to assigned jobs and tasks without admin or billing.',
        },
        {
          question: 'Is there a free trial?',
          answer:
            'Paid business plans include a 14-day trial on your first paid workspace — no credit card required. Business Lite remains free forever.',
        },
      ],
      relatedSegments: relatedExcept('work'),
      signupProfile: 'work_design',
    },

    'commercial-property': {
      slug: 'commercial-property',
      seo: {
        title: 'Commercial property CRM for UK agencies — Ozer',
        description:
          'Published graduated pricing for commercial agencies. Instructions, requirements, interest schedule, and Property Hive sync — without paying for a market-data network you do not use. From £89/mo.',
        keywords: [
          'commercial property CRM UK',
          'commercial agency software',
          'agency WIP board',
          'commercial instructions software',
          'Rightmove commercial CRM',
          'Property Hive CRM',
        ],
      },
      hero: {
        eyebrow: 'Commercial Property workspace',
        title: 'Agency CRM without',
        titleAccent: 'the quote wall',
        subtitle:
          'Disposals, WIP instructions, requirements, and interest — done properly. Transparent graduated pricing competitors hide behind a demo. Built for UK commercial desks, not a Kato network clone.',
      },
      stats: [
        { value: '£89', label: 'From seat 1 / month' },
        { value: 'Public', label: 'Published pricing' },
        { value: '1 Price', label: 'Graduated per seat' },
      ],
      features: [
        {
          icon: Building2,
          title: 'Disposals and marketing',
          description:
            'Listings with units, media, enquiries, and landlord share links — optional Property Hive website sync.',
        },
        {
          icon: ClipboardList,
          title: 'Unified WIP board',
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
          title: 'AI drafts that stay reviewable',
          description:
            'Paste an enquiry to draft a requirement, or generate marketing copy — always confirm before anything is saved.',
        },
        {
          icon: FileText,
          title: 'Portal publishing when you grow',
          description:
            'Rightmove Commercial and EG Propertylink from 2+ billable seats. Solo stays lean without the integration cost.',
        },
        {
          icon: Wallet,
          title: 'Whole Workspace OS',
          description:
            'Invoicing, tasks, notes, meeting intelligence, and email assistant live in the same account — not a bolted-on CRM island.',
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
      pricingNote:
        'Illustrative Solo / Team / Scale labels wrap one graduated Stripe Price. Seat 1 £89 · seats 2–7 £55 · seats 8+ £39. Founding discounts are applied separately for design partners.',
      faqs: [
        {
          question: 'Is this a Kato clone with market data?',
          answer:
            'No. Ozer is the CRM, instructions, and requirements layer — without Agents Society marketplace access. If you need that network, keep Kato; if you want published pricing and the wider Ozer workspace, start here.',
        },
        {
          question: 'How does graduated pricing work?',
          answer:
            'One Price for every agency: £89 for seat 1, £55 for seats 2–7, £39 thereafter. Adding a seat can only raise the total. Solo / Team / Scale cards are friendly examples of that maths — not separate products.',
        },
        {
          question: 'What are support seats?',
          answer:
            'Free seats for admin and finance: they can view records, add notes, and log activity, but cannot move instruction/requirement stages, edit disposals, or publish to portals. Team-sized desks get 2; Scale-sized get 4.',
        },
        {
          question: 'When is portal publishing available?',
          answer:
            'From two billable seats. Solo practitioners keep Property Hive website sync and marketing tools without the portal integration burden.',
        },
        {
          question: 'Why publish price when others hide it?',
          answer:
            'Competitor commercial CRMs are quote-only. A calculable public price is deliberate — you should know the number before a sales call.',
        },
      ],
      relatedSegments: [
        {
          slug: 'work',
          label: 'Business workspace',
          description:
            'Need design-studio CRM instead? Flat team pricing for clients, jobs, and invoices.',
          icon: Briefcase,
        },
      ],
      signupProfile: 'commercial_property',
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
