import type { LucideIcon } from 'lucide-react';
import { Globe, PenLine, Share2 } from 'lucide-react';

import type {
  SegmentFaq,
  SegmentFeature,
} from '~/lib/marketing/segment-landing-pages';

export type AppSlug = 'signatures';

export type AppLandingConfig = {
  slug: AppSlug;
  name: string;
  icon: LucideIcon;
  fromPriceGbp: number;
  productId: string;
  planId: string;
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
    priceBadge?: string;
    primaryCtaLabel?: string;
    secondaryCta?: {
      label: string;
      href: string;
    };
  };
  pricing?: {
    heading: string;
    body: string;
    tiers: Array<{
      name: string;
      mailboxes: string;
      monthlyPlanId: string;
      annualPlanId: string;
    }>;
    included: string[];
    contactLine: string;
    comparisonLine: string;
  };
  pain?: {
    heading: string;
    cards: Array<{
      title: string;
      description: string;
    }>;
  };
  features: SegmentFeature[];
  steps: Array<{ title: string; description: string }>;
  faqs: SegmentFaq[];
};

export const APP_LANDING_SLUGS: AppSlug[] = ['signatures'];

export const APP_LANDING_PAGES: Record<AppSlug, AppLandingConfig> = {
  signatures: {
    slug: 'signatures',
    name: 'Signatures',
    icon: PenLine,
    fromPriceGbp: 9,
    productId: 'ozer-addon-signatures',
    planId: 'signatures-starter-monthly',
    seo: {
      title: 'Team email signatures — Ozer',
      description:
        'Deploy on-brand signatures to Microsoft 365 and Google Workspace with flat tiers from £9 per month. Priced by workspace, never per person.',
      keywords: [
        'email signature manager',
        'Microsoft 365 email signatures',
        'Google Workspace signatures',
        'branded email signatures UK',
        'team email signature software',
      ],
    },
    hero: {
      eyebrow: 'Ozer app — Signatures',
      title: 'Every mailbox on brand.',
      titleAccent: 'No per-seat tax',
      subtitle:
        'Design one signature template, connect Microsoft 365 or Google Workspace, and roll it out to the whole team in minutes. Update the banner once — every mailbox follows. Flat tiers from £9/month — priced by workspace, never per person.',
      priceBadge: 'Flat tiers from £9/mo',
      primaryCtaLabel: 'Start free with Business Lite',
      secondaryCta: {
        label: 'Book a setup call',
        href: 'mailto:info@ozer.so?subject=Signatures%20setup%20call',
      },
    },
    pricing: {
      heading: 'Flat tiers for every mailbox',
      body: 'Pick the mailbox band for this workspace. One workspace equals one brand; additional brands run on additional free Business Lite workspaces with their own Signatures subscription.',
      tiers: [
        {
          name: 'Starter',
          mailboxes: 'Up to 10 mailboxes',
          monthlyPlanId: 'signatures-starter-monthly',
          annualPlanId: 'signatures-starter-yearly',
        },
        {
          name: 'Team',
          mailboxes: 'Up to 50 mailboxes',
          monthlyPlanId: 'signatures-team-monthly',
          annualPlanId: 'signatures-team-yearly',
        },
        {
          name: 'Office',
          mailboxes: 'Up to 150 mailboxes',
          monthlyPlanId: 'signatures-office-monthly',
          annualPlanId: 'signatures-office-yearly',
        },
      ],
      included: [
        'Unlimited templates',
        'Microsoft 365 & Google Workspace deployment',
        'Per-staff personalisation',
        'Campaign banners',
      ],
      contactLine:
        "More than 150 mailboxes? Book a setup call and we'll sort a price.",
      comparisonLine:
        'A 50-person office typically pays £85–100/month with per-seat tools. Ozer Signatures Team is £19 flat.',
    },
    pain: {
      heading: 'The signature problem every office has',
      cards: [
        {
          title: 'Copy-paste chaos',
          description:
            'Everyone builds their own signature in Outlook. Half are off-brand, a third have the old phone number.',
        },
        {
          title: 'The banner nobody updates',
          description:
            'Marketing wants a campaign banner in every signature. IT wants to never think about it again.',
        },
        {
          title: 'Per-seat pricing that stings',
          description:
            'Incumbent tools charge per mailbox, per month. Ozer Signatures uses flat workspace tiers.',
        },
      ],
    },
    features: [
      {
        icon: PenLine,
        title: 'Template designer',
        description:
          'Build reusable signature layouts with your logo, colours, and legal disclaimers — update once, roll out everywhere.',
      },
      {
        icon: Globe,
        title: 'Microsoft 365 & Google',
        description:
          'Connect your directory and push signatures to the right mailboxes without manual IT tickets.',
      },
      {
        icon: Share2,
        title: 'Per-staff personalisation',
        description:
          'Each person gets the right name, title, phone, and booking link while staying on brand.',
      },
    ],
    steps: [
      {
        title: 'Create a free Business Lite workspace',
        description:
          'Ozer apps attach to a business workspace. Business Lite is free — no card required to start free.',
      },
      {
        title: 'Subscribe to Signatures',
        description:
          'Choose Starter, Team, or Office from billing. Each tier is flat for the workspace.',
      },
      {
        title: 'Connect & deploy',
        description:
          'Link Microsoft 365 or Google Workspace, assign templates, and publish signatures to your team.',
      },
    ],
    faqs: [
      {
        question: 'Do I need a paid Ozer business plan?',
        answer:
          'No. Signatures works on free Business Lite. You only pay for the Signatures tier you choose for that workspace.',
      },
      {
        question: 'Which email providers are supported?',
        answer:
          'Signatures integrates with Microsoft 365 and Google Workspace for centralised deployment.',
      },
      {
        question: 'How does this compare to Exclaimer or CodeTwo?',
        answer:
          'Same job — centrally managed signatures deployed to Microsoft 365 or Google Workspace — without per-mailbox pricing. Choose a flat workspace tier by mailbox band, then deploy unlimited signatures inside that tier.',
      },
      {
        question: 'What happens if we grow past our mailbox band?',
        answer:
          "You'll get a prompt to move up a tier — nothing breaks, signatures keep deploying, and the new price applies from your next billing cycle.",
      },
      {
        question: 'What counts as a mailbox?',
        answer:
          "Any directory user a signature is deployed to. Shared mailboxes and aliases that receive a signature count; unlicensed or disabled accounts don't.",
      },
      {
        question: 'Can you set it up for us?',
        answer:
          "Yes — book a setup call and we'll connect your directory, build your first template, and deploy it with you.",
      },
      {
        question: 'Can I use Signatures on multiple brands?',
        answer:
          'Each Ozer workspace is billed separately. Create a workspace per brand or client if you need isolated signature sets.',
      },
    ],
  },
};

export function getAppLandingConfig(slug: string): AppLandingConfig | null {
  if (!APP_LANDING_SLUGS.includes(slug as AppSlug)) {
    return null;
  }

  return APP_LANDING_PAGES[slug as AppSlug];
}

export function listAppLandingSummaries() {
  return APP_LANDING_SLUGS.map((slug) => {
    const config = APP_LANDING_PAGES[slug];

    return {
      slug: config.slug,
      name: config.name,
      icon: config.icon,
      fromPriceGbp: config.fromPriceGbp,
      description: config.seo.description.split('.')[0] + '.',
    };
  });
}

export function getMarketingAppNavLinks() {
  return [
    { label: 'All apps', path: '/apps' },
    ...APP_LANDING_SLUGS.map((slug) => ({
      label: APP_LANDING_PAGES[slug].name,
      path: `/apps/${slug}`,
    })),
  ];
}
