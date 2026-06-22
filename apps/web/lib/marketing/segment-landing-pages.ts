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
      description: 'Free hub — tasks and planner connected across every workspace.',
    },
    work: {
      label: 'Business workspace',
      description: 'Full CRM that plugs into your Life CRM — not a separate silo.',
    },
    property: {
      label: 'Property management',
      description: 'Tenants, maintenance, and portfolio finances in one place.',
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
      title: 'Ozer Personal — Free Workspace Hub for Every Workspace',
      description:
        'Free personal home that connects tasks, planner, and shortcuts across business, family, property, and community workspaces. One workspace OS — not separate apps. No credit card required.',
      keywords: [
        'connected CRM',
        'workspace OS',
        'personal CRM',
        'life organizer app',
        'unified task manager',
        'work and personal CRM',
        'family task manager',
        'free planner app',
        'household organisation software',
      ],
    },
    hero: {
      eyebrow: 'Personal & family — your free hub',
      title: 'One free home for',
      titleAccent: 'life, work, and every workspace',
      subtitle:
        'Ozer is not a siloed CRM. Your personal home unifies tasks, today’s focus, and AI planning across business, family, and community spaces — while personal and family stay completely free.',
    },
    stats: [
      { value: '£0', label: 'Forever — personal & family' },
      { value: '1 hub', label: 'All workspaces connected' },
      { value: 'No credit card', label: 'Get started in minutes' },
    ],
    features: [
      {
        icon: ClipboardList,
        title: 'Tasks across every workspace',
        description:
          'See work, family, and personal tasks in one list from your free home — filter by workspace when you want focus, or keep the full picture.',
      },
      {
        icon: Calendar,
        title: 'Planner & today view',
        description:
          'AI day planning pulls open tasks and calendar from all your spaces. Today view shows your schedule and due items without clutter.',
      },
      {
        icon: Home,
        title: 'Connected workspace overview',
        description:
          'Glance at open tasks and next events per workspace, jump in with one click, and pin any page to your dashboard shortcuts.',
      },
      {
        icon: Users,
        title: 'People & relationships',
        description:
          'Remember context for friends, family, and collaborators — follow-ups, birthdays, and notes in one timeline.',
      },
      {
        icon: ShoppingCart,
        title: 'Family calendar & routines',
        description:
          'Share schedules, school events, meal plans, and shopping lists in a family workspace — still visible from your personal home.',
      },
    ],
    steps: [
      {
        title: 'Create your free account',
        description: 'Sign up in minutes — no credit card, no trial countdown on personal use.',
      },
      {
        title: 'Set up your spaces',
        description:
          'Start with your free personal home, then plug in family, business, or community workspaces — all stay connected.',
      },
      {
        title: 'Invite family members',
        description:
          'Share calendars, lists, and tasks. Members join free — only workspace owners manage billing on paid spaces.',
      },
    ],
    pricingPlans: [freePersonalCard()],
    pricingNote:
      'Personal and family workspaces are always free. Upgrade only when you add a community, business, or property workspace.',
    faqs: [
      {
        question: 'Is Ozer really free for personal use?',
        answer:
          'Yes. Your personal command centre and one family workspace are free with no time limit. You only pay if you create a paid workspace type such as business, property, or community.',
      },
      {
        question: 'Can my partner and children use Ozer?',
        answer:
          'Yes. Invite family members to your family workspace. They can view shared calendars, tasks, meal plans, and shopping lists without needing their own subscription.',
      },
      {
        question: 'How is Ozer different from a generic to-do app or CRM?',
        answer:
          'Most CRMs only handle work — Ozer is a Life CRM. Your free personal home connects tasks, planner, shortcuts, and today’s focus across every workspace. Business CRM features live inside the same account, not a separate silo.',
      },
      {
        question: 'Can I see work tasks from my personal home?',
        answer:
          'Yes. By default your personal home and task list span every workspace you belong to. You can turn workspace tasks off in settings when you want personal-only focus.',
      },
      {
        question: 'Can I use Ozer for freelance work on the free plan?',
        answer:
          'Personal Ozer is for life organisation. When you need clients, invoices, and jobs, create a business workspace — start with free Business Lite or a 14-day trial on Solo.',
      },
    ],
    relatedSegments: relatedExcept('personal'),
    signupProfile: 'family',
  },

  work: {
    slug: 'work',
    seo: {
      title: 'Ozer for Business — Connected CRM Inside Your Workspace OS',
      description:
        'Business CRM, jobs, invoices, and client portal that connects to your personal Ozer home — one login, unified tasks and planning. Not another siloed CRM. Free Business Lite or from £29/mo.',
      keywords: [
        'connected business CRM',
        'workspace OS for business',
        'small business CRM UK',
        'work and personal unified',
        'trade business software',
        'solopreneur CRM',
        'agency project management',
        'CRM not siloed',
      ],
    },
    hero: {
      eyebrow: 'Business workspace — connected, not siloed',
      title: 'A full business CRM that stays',
      titleAccent: 'connected to your life',
      subtitle:
        'Run clients, jobs, and billing in a proper workspace — while your personal home still sees today’s tasks, planner, and shortcuts across work and life. One account, not five apps.',
    },
    stats: [
      { value: '£0', label: 'Business Lite — apps & team' },
      { value: '1 login', label: 'Personal + business together' },
      { value: 'Connected', label: 'Tasks & planner span workspaces' },
    ],
    features: [
      {
        icon: Home,
        title: 'CRM inside your Life CRM',
        description:
          'Unlike HubSpot or Pipedrive, Ozer business workspaces plug into your free personal home — unified tasks, today view, and AI planner across work and life.',
      },
      {
        icon: Users,
        title: 'Clients & pipeline',
        description:
          'Track leads, deals, and live clients. Move opportunities through your pipeline with full context.',
      },
      {
        icon: ClipboardList,
        title: 'Jobs & projects',
        description:
          'Plan work, assign team members, attach notes and files, and message on the job record.',
      },
      {
        icon: FileText,
        title: 'Invoices, proposals & contracts',
        description:
          'Send professional documents, collect signatures, and keep finance tied to the client and job.',
      },
      {
        icon: MessageSquare,
        title: 'Team & client messaging',
        description:
          'WhatsApp-style threads for your team and clients, with shared files clients are allowed to view.',
      },
      {
        icon: Building2,
        title: 'Client portal',
        description:
          'Give clients a branded space for proposals, invoices, support tickets, and shared documents.',
      },
      {
        icon: Wallet,
        title: 'Finances & SOPs',
        description:
          'Track income and costs, document repeatable processes, and onboard staff with checklist playbooks.',
      },
    ],
    steps: [
      {
        title: 'Start free or trial',
        description:
          'Create Business Lite at £0 for apps and team settings, or start a 14-day trial on Solo, Team, or Scale.',
      },
      {
        title: 'Import your clients & jobs',
        description:
          'Add clients, open jobs, and connect notes and files — your workspace is ready for day-to-day delivery.',
      },
      {
        title: 'Invite your team & clients',
        description:
          'Staff and contractors join the workspace; clients get portal access when you are ready to share work.',
      },
    ],
    pricingPlans: MARKETING_WORKSPACE_PLANS.filter(
      (p) => p.profile === 'work_design',
    ).map((p) => planToCard(p)),
    pricingNote:
      'Add-ons such as Rankly (SEO), Feedflow (reviews), Videos, and Signatures (£9/mo) attach per workspace after signup. Annual billing saves about two months.',
    faqs: [
      {
        question: 'How is Ozer different from other CRMs?',
        answer:
          'Traditional CRMs silo work away from the rest of your life. Ozer is a Life CRM — your business workspace connects to a free personal home where tasks, planner, shortcuts, and today’s focus span every workspace. One login, one mental model.',
      },
      {
        question: 'Can I plan my day across business and personal tasks?',
        answer:
          'Yes. Ozer Planner and Today view pull from all workspaces you enable. Solopreneurs see client work and personal errands in one AI-generated schedule — then push blocks to Google Calendar.',
      },
      {
        question: 'What is the difference between Business Lite and Solo?',
        answer:
          'Business Lite is free and includes apps marketplace access, team settings, and brand basics — ideal if you mainly want add-ons like Signatures or Rankly. Solo adds full CRM modules: clients, jobs, invoices, pipeline, messages, SOPs, and more for one person.',
      },
      {
        question: 'Do my clients need to pay for Ozer?',
        answer:
          'No. Clients use your client portal or message threads at no cost. Billing stays with the workspace owner.',
      },
      {
        question: 'Can contractors access jobs without seeing finances?',
        answer:
          'Yes. Role-based access lets contractors work on assigned jobs and tasks without full admin or billing visibility.',
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
      title: 'Ozer for Property — Landlord & Portfolio Management Software',
      description:
        'Manage rental properties, tenants, maintenance, and finances in Ozer. From £19/mo for up to 5 properties or £29/mo for portfolios up to 20. 14-day free trial.',
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
      eyebrow: 'Property business',
      title: 'Portfolio, tenants, and maintenance in',
      titleAccent: 'one property workspace',
      subtitle:
        'Whether you manage five doors or twenty, Ozer keeps properties, tenants, repairs, and finances organised — without spreadsheet chaos.',
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
      title: 'Ozer for Community Groups — Schedule, Tasks & Shared Notes',
      description:
        'Organise clubs, homegroups, and volunteer teams with Ozer Community: shared schedule, group tasks, notes, and member directory. £12/mo with 3 members included. 14-day trial.',
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
      title: 'Coordinate your group with',
      titleAccent: 'shared schedule & tasks',
      subtitle:
        'For clubs, homegroups, societies, and volunteer teams — replace scattered WhatsApp threads and spreadsheets with one calm group workspace.',
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
        title: 'Works alongside Ozer personal',
        description:
          'Leaders keep their personal Life CRM while the group gets its own dedicated workspace.',
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
