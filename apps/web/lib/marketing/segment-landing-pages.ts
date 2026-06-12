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
      description: 'Free Life CRM for tasks, planner, and shared family routines.',
    },
    work: {
      label: 'Business workspace',
      description: 'CRM, jobs, invoices, and client portal for service businesses.',
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
      title: 'Keel Personal — Free Life CRM for Tasks, Planner & Family',
      description:
        'Organise your personal life with Keel: free tasks, planner, pipeline, and a family workspace with shared calendar, meal planning, shopping lists, and notes. No credit card required.',
      keywords: [
        'personal CRM',
        'life organizer app',
        'family task manager',
        'shared family calendar UK',
        'free planner app',
        'household organisation software',
        'Life CRM',
      ],
    },
    hero: {
      eyebrow: 'Personal & family',
      title: 'Your free Life CRM for',
      titleAccent: 'tasks, plans, and family life',
      subtitle:
        'Keel gives you one calm place for your to-dos, goals, appointments, and household coordination — without paying for another subscription.',
    },
    stats: [
      { value: '£0', label: 'Forever — personal & family' },
      { value: '100%', label: 'Free — no hidden fees' },
      { value: 'No credit card', label: 'Get started in minutes' },
    ],
    features: [
      {
        icon: ClipboardList,
        title: 'Personal tasks & planner',
        description:
          'Capture what matters today, this week, and later. Keel keeps priorities visible so nothing important slips through.',
      },
      {
        icon: Users,
        title: 'People & relationships',
        description:
          'Remember context for friends, family, and collaborators — follow-ups, birthdays, and notes in one timeline.',
      },
      {
        icon: Calendar,
        title: 'Family calendar & routines',
        description:
          'Share schedules, school events, and appointments in a family workspace everyone can see.',
      },
      {
        icon: ShoppingCart,
        title: 'Meal plan & shopping lists',
        description:
          'Plan meals and sync shopping lists so the whole household stays aligned on food and errands.',
      },
      {
        icon: FileText,
        title: 'Shared notes & files',
        description:
          'Store recipes, school letters, and household documents where the family can find them.',
      },
      {
        icon: Home,
        title: 'Household dashboard',
        description:
          'See what needs attention across personal and family spaces from a single home screen.',
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
          'Use your personal command centre and add a family workspace when you are ready.',
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
        question: 'Is Keel really free for personal use?',
        answer:
          'Yes. Your personal command centre and one family workspace are free with no time limit. You only pay if you create a paid workspace type such as business, property, or community.',
      },
      {
        question: 'Can my partner and children use Keel?',
        answer:
          'Yes. Invite family members to your family workspace. They can view shared calendars, tasks, meal plans, and shopping lists without needing their own subscription.',
      },
      {
        question: 'How is Keel different from a generic to-do app?',
        answer:
          'Keel is a Life CRM — it connects people, plans, and priorities together. You get tasks and a planner plus relationship context, shared family tools, and optional work or community workspaces in the same account.',
      },
      {
        question: 'Can I use Keel for freelance work on the free plan?',
        answer:
          'Personal Keel is for life organisation. When you need clients, invoices, and jobs, create a business workspace — start with free Business Lite or a 14-day trial on Solo.',
      },
    ],
    relatedSegments: relatedExcept('personal'),
    signupProfile: 'family',
  },

  work: {
    slug: 'work',
    seo: {
      title: 'Keel for Business — CRM, Jobs, Invoices & Client Portal',
      description:
        'Run your service business on Keel: clients, pipeline, jobs, invoices, proposals, contracts, messaging, SOPs, and client portal. Free Business Lite or from £29/mo with a 14-day trial.',
      keywords: [
        'small business CRM UK',
        'trade business software',
        'invoicing and job management',
        'client portal for small business',
        'service business workspace',
        'solopreneur CRM',
        'agency project management',
      ],
    },
    hero: {
      eyebrow: 'Business workspace',
      title: 'Run clients, jobs, and cash flow from',
      titleAccent: 'one business workspace',
      subtitle:
        'Built for solopreneurs, agencies, and service teams who want CRM, delivery, and billing without juggling five different apps.',
    },
    stats: [
      { value: '£0', label: 'Business Lite — apps & team' },
      { value: '14 days', label: 'Free trial on paid plans' },
      { value: '1 login', label: 'Personal + business together' },
    ],
    features: [
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
        question: 'What is the difference between Business Lite and Solo?',
        answer:
          'Business Lite is free and includes apps marketplace access, team settings, and brand basics — ideal if you mainly want add-ons like Signatures or Rankly. Solo adds full CRM modules: clients, jobs, invoices, pipeline, messages, SOPs, and more for one person.',
      },
      {
        question: 'Do my clients need to pay for Keel?',
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
      title: 'Keel for Property — Landlord & Portfolio Management Software',
      description:
        'Manage rental properties, tenants, maintenance, and finances in Keel. From £19/mo for up to 5 properties or £29/mo for portfolios up to 20. 14-day free trial.',
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
        'Whether you manage five doors or twenty, Keel keeps properties, tenants, repairs, and finances organised — without spreadsheet chaos.',
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
        question: 'Who is Keel property software for?',
        answer:
          'Keel suits private landlords, small letting agents, and portfolio holders who want properties, tenants, maintenance, and finances in one system — not enterprise block management.',
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
        question: 'Does Keel replace accounting software?',
        answer:
          'Keel tracks property-level finances and cash flow. Many landlords still use Xero or FreeAgent for statutory accounts — Keel focuses on operational property management.',
      },
    ],
    relatedSegments: relatedExcept('property'),
    signupProfile: 'work_property',
  },

  community: {
    slug: 'community',
    seo: {
      title: 'Keel for Community Groups — Schedule, Tasks & Shared Notes',
      description:
        'Organise clubs, homegroups, and volunteer teams with Keel Community: shared schedule, group tasks, notes, and member directory. £12/mo with 3 members included. 14-day trial.',
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
        title: 'Works alongside Keel personal',
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
      'Community billing is per workspace. Personal Keel accounts remain free for members who only need their own Life CRM.',
    faqs: [
      {
        question: 'What types of groups use Keel Community?',
        answer:
          'Homegroups, sports clubs, hobby societies, PTAs, and volunteer teams use Keel to coordinate schedules, tasks, and shared notes without enterprise church or club software complexity.',
      },
      {
        question: 'How much does Keel Community cost?',
        answer:
          'The Community plan is £12 per month (or £120 annually) and includes 3 members. Start with a 14-day free trial when you create the workspace.',
      },
      {
        question: 'Do group members need their own subscription?',
        answer:
          'Invited members join your community workspace without paying. They can also use a free personal Keel account for their own tasks and planner.',
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
