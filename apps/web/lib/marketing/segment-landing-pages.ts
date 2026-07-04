import type { LucideIcon } from 'lucide-react';
import {
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
  Wrench,
} from 'lucide-react';

import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import {
  MARKETING_FREE_TIER,
  MARKETING_WORKSPACE_PLANS,
  type MarketingWorkspacePlan,
} from '~/lib/billing/pricing-marketing';

export type SegmentSlug = 'personal' | 'work' | 'property' | 'community';

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
  const price = interval === 'year' ? plan.yearlyPriceGbp : plan.monthlyPriceGbp;
  const planId =
    interval === 'year' ? plan.yearlyPlanId : plan.monthlyPlanId;

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

const ALL_SEGMENTS: SegmentSlug[] = ['personal', 'work', 'property', 'community'];

const SEGMENT_ICONS: Record<SegmentSlug, LucideIcon> = {
  personal: Home,
  work: Briefcase,
  property: Building2,
  community: Users,
};

function relatedExcept(current: SegmentSlug) {
  const map: Record<
    SegmentSlug,
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
    property: {
      label: 'Property management',
      description: 'Tenants, maintenance, and portfolio money in one place.',
    },
    community: {
      label: 'Community groups',
      description: 'Schedules, tasks, and notes for clubs and homegroups.',
    },
  };

  return ALL_SEGMENTS.filter((slug) => slug !== current).map((slug) => ({
    slug,
    icon: SEGMENT_ICONS[slug],
    ...map[slug],
  }));
}

export const SEGMENT_LANDING_PAGES: Record<SegmentSlug, SegmentLandingConfig> = {
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
        'Clients, jobs, and invoices in a business workspace linked to free personal home. Flat price for the whole team from £0–£29 per month.',
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
        'Ozer’s business workspace answers “where do clients, jobs, and invoices live?” Pipeline, delivery, billing, and portals in one workspace — while personal home still sees today’s tasks. One account. One price for the team.',
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
      'Add-ons such as Rankly, Feedflow, Videos, and Signatures (£9/mo) attach per workspace. Annual billing is 16.7% less than paying monthly for twelve months. One workspace price covers the team.',
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
          'Paid business plans include a 14-day trial on your first paid workspace. Business Lite remains free with no card required.',
      },
    ],
    relatedSegments: relatedExcept('work'),
    signupProfile: 'work_design',
  },

  property: {
    slug: 'property',
    seo: {
      title: 'Property portfolio workspace — Ozer',
      description:
        'Manage rentals, tenants, maintenance, and finances from £19 per month. Flat price for the whole team. 14-day trial.',
      keywords: [
        'property management software UK',
        'landlord software',
        'tenant management app',
        'rental portfolio tracker',
        'maintenance requests landlords',
        'property finances software',
      ],
    },
    hero: {
      eyebrow: 'Property workspace',
      title: 'Portfolio, tenants, and repairs in',
      titleAccent: 'one property workspace',
      subtitle:
        'Ozer property answers “where is this tenancy and repair?” Five doors or twenty — properties, tenants, maintenance, and money without spreadsheet chaos. From £19/mo.',
    },
    stats: [
      { value: '5–20', label: 'Properties per plan tier' },
      { value: '14 days', label: 'Free trial' },
      { value: 'UK £', label: 'Pricing in GBP' },
    ],
    features: [
      {
        icon: Building2,
        title: 'Property register',
        description:
          'Centralise addresses, units, keys, and documents for every property in your portfolio.',
      },
      {
        icon: Users,
        title: 'Tenants & contacts',
        description:
          'Store tenant details, lease context, and communication history linked to each property.',
      },
      {
        icon: Wrench,
        title: 'Maintenance & jobs',
        description:
          'Log repairs, track status, and assign work so nothing falls through between tenancies.',
      },
      {
        icon: Wallet,
        title: 'Property finances',
        description:
          'Monitor income, costs, and cash flow at portfolio level with clear property attribution.',
      },
      {
        icon: FileText,
        title: 'Docs & compliance notes',
        description:
          'Keep certificates, inspections, and correspondence attached to the right property or tenant.',
      },
      {
        icon: ClipboardList,
        title: 'Tasks & reminders',
        description:
          'Schedule gas checks, rent reviews, and viewings with tasks tied to properties.',
      },
    ],
    steps: [
      {
        title: 'Start your 14-day trial',
        description:
          'Choose Property Starter (up to 5 properties) or Portfolio (up to 20) — cancel anytime during trial.',
      },
      {
        title: 'Add properties & tenants',
        description:
          'Build your register and link active tenancies so maintenance and finances stay in context.',
      },
      {
        title: 'Run day-to-day from the dashboard',
        description:
          'See open maintenance, upcoming tasks, and portfolio health at a glance.',
      },
    ],
    pricingPlans: MARKETING_WORKSPACE_PLANS.filter(
      (p) => p.profile === 'work_property',
    ).map((p) => planToCard(p)),
    pricingNote:
      'Need more than 20 properties? Contact us for Scale pricing. All plans billed per property workspace.',
    faqs: [
      {
        question: 'Who is Ozer property software for?',
        answer:
          'Ozer suits private landlords, small letting agents, and portfolio holders who want properties, tenants, maintenance, and finances in one system — not enterprise block management.',
      },
      {
        question: 'How many properties can I manage?',
        answer:
          'Property Starter supports up to 5 properties for £19/mo. Property Portfolio supports up to 20 properties for £29/mo. Contact us if you need a higher limit.',
      },
      {
        question: 'Can I track maintenance requests?',
        answer:
          'Yes. Log issues as maintenance jobs, assign them, and keep a history per property for handovers and compliance.',
      },
      {
        question: 'Does Ozer replace accounting software?',
        answer:
          'Ozer tracks property-level finances and cash flow. Many landlords still use Xero or FreeAgent for statutory accounts — Ozer focuses on operational property management.',
      },
    ],
    relatedSegments: relatedExcept('property'),
    signupProfile: 'work_property',
  },

  community: {
    slug: 'community',
    seo: {
      title: 'Community group workspace — Ozer',
      description:
        'Shared schedule, tasks, and notes for clubs and homegroups. £12 per month with three members included. Flat price for the whole team.',
      keywords: [
        'community group software',
        'church homegroup planner',
        'club management app',
        'volunteer team schedule',
        'small community organisation tools',
        'group task management UK',
      ],
    },
    hero: {
      eyebrow: 'Community groups',
      title: 'Coordinate the group with',
      titleAccent: 'shared schedule and tasks',
      subtitle:
        'Ozer community answers “who is doing what this week?” Clubs, homegroups, and volunteer teams — one workspace instead of WhatsApp threads and spreadsheets. £12/mo, three members included.',
    },
    stats: [
      { value: '£12/mo', label: 'Community plan' },
      { value: '3', label: 'Members included' },
      { value: '14 days', label: 'Free trial' },
    ],
    features: [
      {
        icon: Calendar,
        title: 'Shared schedule & events',
        description:
          'Publish meetings, services, and socials so everyone knows what is happening and when.',
      },
      {
        icon: ClipboardList,
        title: 'Group tasks',
        description:
          'Assign rota items, prep work, and follow-ups with clear ownership across members.',
      },
      {
        icon: FileText,
        title: 'Shared notes',
        description:
          'Keep agendas, study notes, and resources where the whole group can access them.',
      },
      {
        icon: Users,
        title: 'Members directory',
        description:
          'Manage who is in the group and what they help with — without a separate contact spreadsheet.',
      },
      {
        icon: Home,
        title: 'Group dashboard',
        description:
          'Leaders see upcoming events, open tasks, and recent notes from one home screen.',
      },
      {
        icon: MessageSquare,
        title: 'Works alongside personal home',
        description:
          'Leaders keep their free personal home while the group gets its own workspace.',
      },
    ],
    steps: [
      {
        title: 'Create a community workspace',
        description:
          'Start a 14-day trial on the Community plan — £12/mo after trial, 3 members included.',
      },
      {
        title: 'Add your schedule & rota',
        description:
          'Post recurring events and task lists so members know how to serve and participate.',
      },
      {
        title: 'Invite members',
        description:
          'Send invites to leaders and participants. Additional members can be added as you grow.',
      },
    ],
    pricingPlans: MARKETING_WORKSPACE_PLANS.filter(
      (p) => p.profile === 'community',
    ).map((p) => planToCard(p)),
    pricingNote:
      'Community billing is per workspace. Personal Ozer accounts remain free for members who only need their own Life CRM.',
    faqs: [
      {
        question: 'What types of groups use Ozer Community?',
        answer:
          'Homegroups, sports clubs, hobby societies, PTAs, and volunteer teams use Ozer to coordinate schedules, tasks, and shared notes without enterprise church or club software complexity.',
      },
      {
        question: 'How much does Ozer Community cost?',
        answer:
          'The Community plan is £12 per month (or £120 annually) and includes 3 members. Start with a 14-day free trial when you create the workspace.',
      },
      {
        question: 'Do group members need their own subscription?',
        answer:
          'Invited members join your community workspace without paying. They can also use a free personal Ozer account for their own tasks and planner.',
      },
      {
        question: 'Can we share documents and meeting notes?',
        answer:
          'Yes. Use shared notes to store agendas, study material, and files. Leaders control what is visible inside the group workspace.',
      },
    ],
    relatedSegments: relatedExcept('community'),
    signupProfile: 'community',
  },
};

export function getSegmentLandingConfig(slug: string): SegmentLandingConfig | null {
  if (slug in SEGMENT_LANDING_PAGES) {
    return SEGMENT_LANDING_PAGES[slug as SegmentSlug];
  }
  return null;
}

const WORKSPACE_NAV_PATHS: Record<SegmentSlug, string> = {
  personal: '/personal',
  work: '/work',
  property: '/property',
  community: '/community',
};

const WORKSPACE_NAV_LABELS: Record<SegmentSlug, string> = {
  personal: 'Personal',
  work: 'Business',
  property: 'Property',
  community: 'Community',
};

const WORKSPACE_NAV_DESCRIPTIONS: Record<SegmentSlug, string> = {
  personal:
    'Free hub — tasks and planner connected across every workspace.',
  work: 'Full CRM that plugs into your Life CRM — not a separate silo.',
  property: 'Tenants, maintenance, and portfolio finances in one place.',
  community: 'Schedules, tasks, and notes for clubs and homegroups.',
};

export function getMarketingWorkspaceNavLinks() {
  return ALL_SEGMENTS.map((slug) => ({
    slug,
    label: WORKSPACE_NAV_LABELS[slug],
    path: WORKSPACE_NAV_PATHS[slug],
    description: WORKSPACE_NAV_DESCRIPTIONS[slug],
    icon: SEGMENT_ICONS[slug],
  }));
}

export function isWorkspaceNavPath(pathname: string) {
  return getMarketingWorkspaceNavLinks().some(
    (item) =>
      pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
}
