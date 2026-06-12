import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Globe,
  Lock,
  MessageSquareText,
  PenLine,
  Share2,
  Video,
} from 'lucide-react';

import type { SegmentFeature, SegmentFaq } from '~/lib/marketing/segment-landing-pages';

export type AppSlug = 'signatures' | 'rankly' | 'feedflow' | 'videos';

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
  };
  features: SegmentFeature[];
  steps: Array<{ title: string; description: string }>;
  faqs: SegmentFaq[];
};

export const APP_LANDING_SLUGS: AppSlug[] = [
  'signatures',
  'rankly',
  'feedflow',
  'videos',
];

export const APP_LANDING_PAGES: Record<AppSlug, AppLandingConfig> = {
  signatures: {
    slug: 'signatures',
    name: 'Signatures',
    icon: PenLine,
    fromPriceGbp: 9,
    productId: 'keel-addon-signatures',
    planId: 'signatures-monthly',
    seo: {
      title: 'Keel Signatures — Branded Email Signatures for Teams',
      description:
        'Deploy consistent, on-brand email signatures across Microsoft 365 and Google Workspace. From £9/mo per workspace with Keel Business Lite.',
      keywords: [
        'email signature manager',
        'Microsoft 365 email signatures',
        'Google Workspace signatures',
        'branded email signatures UK',
        'team email signature software',
      ],
    },
    hero: {
      eyebrow: 'Keel app',
      title: 'On-brand email signatures for',
      titleAccent: 'every team member',
      subtitle:
        'Stop copying HTML from a shared doc. Signatures gives you templates, staff profiles, and one-click deployment to Microsoft 365 or Google Workspace.',
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
          'Keel apps attach to a business workspace. Business Lite is free — no card required to get started.',
      },
      {
        title: 'Subscribe to Signatures',
        description: 'Add the Signatures app from billing for £9/mo on that workspace.',
      },
      {
        title: 'Connect & deploy',
        description:
          'Link Microsoft 365 or Google Workspace, assign templates, and publish signatures to your team.',
      },
    ],
    faqs: [
      {
        question: 'Do I need a paid Keel business plan?',
        answer:
          'No. Signatures works on free Business Lite. You only pay for the Signatures add-on (£9/mo per workspace).',
      },
      {
        question: 'Which email providers are supported?',
        answer:
          'Signatures integrates with Microsoft 365 and Google Workspace for centralised deployment.',
      },
      {
        question: 'Can I use Signatures on multiple brands?',
        answer:
          'Each Keel workspace is billed separately. Create a workspace per brand or client if you need isolated signature sets.',
      },
    ],
  },

  rankly: {
    slug: 'rankly',
    name: 'Rankly',
    icon: BarChart3,
    fromPriceGbp: 36,
    productId: 'keel-addon-rankly',
    planId: 'rankly-monthly',
    seo: {
      title: 'Keel Rankly — SEO Rank Tracking, Audits & Content Briefs',
      description:
        'Track keyword rankings, run PageSpeed scans, explore site structure, and generate content briefs — £36/mo per workspace inside Keel.',
      keywords: [
        'SEO rank tracker UK',
        'keyword rank tracking software',
        'PageSpeed monitoring',
        'SEO content briefs',
        'site explorer SEO tool',
      ],
    },
    hero: {
      eyebrow: 'Keel app',
      title: 'Your SEO command centre with',
      titleAccent: 'rankings, audits & briefs',
      subtitle:
        'Rankly brings rank tracking, PageSpeed, site explorer, clustering, and AI-assisted briefs into the same workspace where you run client work.',
    },
    features: [
      {
        icon: BarChart3,
        title: 'Rank tracking',
        description:
          'Monitor keyword positions over time with project-level dashboards and alerts when rankings move.',
      },
      {
        icon: Globe,
        title: 'Site explorer & crawler',
        description:
          'Understand site structure, indexable pages, and technical issues without leaving Keel.',
      },
      {
        icon: PenLine,
        title: 'Content briefs & clusters',
        description:
          'Turn keyword research into actionable briefs and topic clusters your team can execute on.',
      },
    ],
    steps: [
      {
        title: 'Start with Business Lite',
        description: 'Create a free apps workspace — Rankly installs as an add-on when you are ready.',
      },
      {
        title: 'Add Rankly (£36/mo)',
        description: 'Subscribe from workspace billing. One Rankly subscription covers that workspace.',
      },
      {
        title: 'Create SEO projects',
        description:
          'Add domains, track keywords, run PageSpeed, and share briefs with your delivery team.',
      },
    ],
    faqs: [
      {
        question: 'Is Rankly per workspace or per user?',
        answer:
          'Rankly is billed per Keel workspace (£36/mo). Team members on that workspace can access projects according to their role.',
      },
      {
        question: 'Does Rankly replace Ahrefs or Semrush?',
        answer:
          'Rankly focuses on rank tracking, on-site exploration, PageSpeed, and briefs tied to your client delivery — many teams use it alongside broader research tools.',
      },
      {
        question: 'Can agencies use Rankly for multiple clients?',
        answer:
          'Yes. Create separate projects within a workspace, or use multiple workspaces for strict client separation.',
      },
    ],
  },

  feedflow: {
    slug: 'feedflow',
    name: 'Feedflow',
    icon: MessageSquareText,
    fromPriceGbp: 9,
    productId: 'keel-addon-feedflow',
    planId: 'feedflow-monthly',
    seo: {
      title: 'Keel Feedflow — Review Widgets & Social Publishing',
      description:
        'Collect reviews, embed trust widgets on your site, and manage social accounts from Keel. Feedflow from £9/mo per workspace.',
      keywords: [
        'review widget software',
        'Google reviews embed',
        'social media publishing tool',
        'customer review management UK',
        'review aggregation widget',
      ],
    },
    hero: {
      eyebrow: 'Keel app',
      title: 'Turn reviews and social into',
      titleAccent: 'proof that converts',
      subtitle:
        'Feedflow helps you showcase customer reviews on your website and keep social accounts connected — without another standalone marketing login.',
    },
    features: [
      {
        icon: MessageSquareText,
        title: 'Review widgets',
        description:
          'Embed polished review carousels and badges that pull from the sources your customers trust.',
      },
      {
        icon: Share2,
        title: 'Social accounts',
        description:
          'Connect accounts and manage publishing workflows alongside your brand workspace.',
      },
      {
        icon: Video,
        title: 'Video snippets',
        description:
          'Highlight short video testimonials and social clips where they drive the most impact.',
      },
    ],
    steps: [
      {
        title: 'Open a Business Lite workspace',
        description: 'Free to create — Feedflow is an optional add-on when you need reviews and social tools.',
      },
      {
        title: 'Subscribe to Feedflow',
        description: 'Enable the app from billing for £9/mo on your workspace.',
      },
      {
        title: 'Connect sources & embed',
        description: 'Link review platforms and social accounts, then drop widgets on your site.',
      },
    ],
    faqs: [
      {
        question: 'Which review platforms does Feedflow support?',
        answer:
          'Feedflow focuses on aggregating and displaying reviews via embeddable widgets. Connect the sources available in your workspace setup flow.',
      },
      {
        question: 'Can I use Feedflow on client sites?',
        answer:
          'Yes. Each workspace can power widgets for that brand. Agencies often use one workspace per client.',
      },
      {
        question: 'Is Feedflow included in Business Solo?',
        answer:
          'No — Feedflow is a separate add-on (£9/mo). Business Solo includes full CRM modules; apps are optional extras.',
      },
    ],
  },

  videos: {
    slug: 'videos',
    name: 'Videos',
    icon: Video,
    fromPriceGbp: 5,
    productId: 'keel-addon-videos-starter',
    planId: 'videos-starter-monthly',
    seo: {
      title: 'Keel Videos — Hosted Video Library & Embeds',
      description:
        'Host videos with private/public controls, shareable public links, custom branded players, and embed codes for Webflow, WordPress, and any website. Plans from £5/mo per workspace.',
      keywords: [
        'hosted video embed',
        'video hosting for business',
        'custom video player',
        'website video library',
        'video marketing embed UK',
        'Webflow video embed',
        'WordPress video hosting',
        'private public video hosting',
      ],
    },
    hero: {
      eyebrow: 'Keel app',
      title: 'Professional video hosting with',
      titleAccent: 'embeds, sharing & branded players',
      subtitle:
        'Keep videos private in your library or publish shareable watch links. Custom player presets match your brand — then paste embed codes on Webflow, WordPress, or any site.',
    },
    features: [
      {
        icon: Lock,
        title: 'Private & public videos',
        description:
          'Keep internal clips workspace-only, or enable public sharing when you want a link anyone can watch — no Keel login required.',
      },
      {
        icon: Share2,
        title: 'Public watch links',
        description:
          'Generate a dedicated public page per video. Copy the link for email, social, or proposals alongside your embeds.',
      },
      {
        icon: PenLine,
        title: 'Custom branded players',
        description:
          'Save reusable player presets — colours, controls, autoplay, and branding — so every embed looks like your site, not a generic host.',
      },
      {
        icon: Globe,
        title: 'Embed anywhere',
        description:
          'Iframe, HTML5, and JavaScript embed codes plus Webflow-specific instructions. Works on WordPress, Squarespace, custom sites, and client portals.',
      },
      {
        icon: Video,
        title: 'Hosted library',
        description:
          'Upload sales demos, testimonials, and training clips once. Organise in folders and manage everything from your workspace.',
      },
    ],
    steps: [
      {
        title: 'Create Business Lite',
        description: 'Start free, then pick a Videos tier when you are ready to upload.',
      },
      {
        title: 'Choose a Videos plan',
        description:
          'Starter (5 videos, £5/mo), Growth (20, £12/mo), Pro (49, £29/mo), or Studio (100, £47/mo).',
      },
      {
        title: 'Upload & embed',
        description:
          'Set private or public sharing, pick a branded preset, then copy embed code or a public link for Webflow, WordPress, or any page.',
      },
    ],
    faqs: [
      {
        question: 'How many videos can I host?',
        answer:
          'Starter includes up to 5 videos (£5/mo). Upgrade tiers add 20, 49, or 100 videos per workspace.',
      },
      {
        question: 'Can I embed videos on Webflow or WordPress?',
        answer:
          'Yes. Every video includes iframe, HTML5, and JavaScript embed codes. Webflow-specific copy-paste instructions are built in — WordPress and other CMS platforms work with the standard iframe embed.',
      },
      {
        question: 'What is the difference between private and public videos?',
        answer:
          'Private videos are only accessible via embed codes you place on authorised sites, or when signed into your workspace. Public videos get a shareable watch link you can send to anyone — ideal for sales demos, testimonials, or marketing pages.',
      },
      {
        question: 'Can I change tiers later?',
        answer:
          'Yes. Upgrade or downgrade from workspace billing as your library grows.',
      },
      {
        question: 'Is Videos the same as Feedflow video snippets?',
        answer:
          'Videos is full hosted video with private/public controls, public links, branded players, and site embeds. Feedflow video snippets focus on short social and review clips — many teams use both.',
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
