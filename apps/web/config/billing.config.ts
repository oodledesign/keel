import { BillingProviderSchema, createBillingSchema } from '@kit/billing';

import {
  OZER_BILLING_CURRENCY,
  OZER_STRIPE_PRICES,
} from '~/lib/billing/stripe-price-ids';

const provider = BillingProviderSchema.parse(
  process.env.NEXT_PUBLIC_BILLING_PROVIDER,
);

const TRIAL_DAYS = 14;

export default createBillingSchema({
  provider,
  products: [
    {
      id: 'ozer-community',
      name: 'Community',
      description:
        'Groups, schedules, and shared tasks for clubs and homegroups',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'community-monthly',
          name: 'Community Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.community_monthly,
              name: 'Community workspace',
              cost: 12,
              type: 'flat',
            },
          ],
        },
        {
          id: 'community-yearly',
          name: 'Community Yearly',
          paymentType: 'recurring',
          interval: 'year',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.community_yearly,
              name: 'Community workspace',
              cost: 120,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Shared schedule & events',
        'Group tasks & notes',
        'Up to 3 members included',
      ],
    },
    {
      id: 'ozer-business-lite',
      name: 'Business Lite',
      description:
        'Free apps workspace — install Signatures and future add-ons',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'business-lite-free',
          name: 'Lite',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.business_lite_monthly,
              name: 'Business Lite',
              cost: 0,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Apps marketplace access',
        'Team & brand settings',
        'Pay only for the apps you use',
      ],
    },
    {
      id: 'ozer-business-solo',
      name: 'Business Solo',
      description: 'Full business workspace for one person',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'business-solo-monthly',
          name: 'Solo Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.business_solo_monthly,
              name: 'Business Solo',
              cost: 29,
              type: 'flat',
            },
          ],
        },
        {
          id: 'business-solo-yearly',
          name: 'Solo Yearly',
          paymentType: 'recurring',
          interval: 'year',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.business_solo_yearly,
              name: 'Business Solo',
              cost: 290,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Apps marketplace access',
        'Clients, jobs, invoices & tasks',
        'Activity tracking',
        '1 team member (you)',
        '2,000 AI credits / month',
        'Docs, finances & pipeline',
      ],
    },
    {
      id: 'ozer-business-team',
      name: 'Business Team',
      highlighted: true,
      badge: 'Popular',
      description: 'Collaborate with a small team',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'business-team-monthly',
          name: 'Team Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.business_team_monthly,
              name: 'Business Team',
              cost: 79,
              type: 'flat',
            },
          ],
        },
        {
          id: 'business-team-yearly',
          name: 'Team Yearly',
          paymentType: 'recurring',
          interval: 'year',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.business_team_yearly,
              name: 'Business Team',
              cost: 790,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Everything in Solo',
        'Up to 5 team members',
        '5,000 AI credits / month',
        'Shared client & project work',
      ],
    },
    {
      id: 'ozer-business-scale',
      name: 'Business Scale',
      description: 'Larger teams with more seats',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'business-scale-monthly',
          name: 'Scale Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.business_scale_monthly,
              name: 'Business Scale',
              cost: 149,
              type: 'flat',
            },
          ],
        },
        {
          id: 'business-scale-yearly',
          name: 'Scale Yearly',
          paymentType: 'recurring',
          interval: 'year',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.business_scale_yearly,
              name: 'Business Scale',
              cost: 1490,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Everything in Team',
        'Up to 15 team members',
        'Need more seats? Request extra users anytime',
        '12,000 AI credits / month',
        'Priority support',
      ],
    },
    {
      id: 'ozer-property-starter',
      name: 'Property Starter',
      description: 'Landlords and small portfolios',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'property-starter-monthly',
          name: 'Starter Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.property_starter_monthly,
              name: 'Property Starter',
              cost: 19,
              type: 'flat',
            },
          ],
        },
        {
          id: 'property-starter-yearly',
          name: 'Starter Yearly',
          paymentType: 'recurring',
          interval: 'year',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.property_starter_yearly,
              name: 'Property Starter',
              cost: 190,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Up to 5 properties',
        'Tenants & maintenance jobs',
        'Property finances & documents',
        'Compliance notes per property',
      ],
    },
    {
      id: 'ozer-property-portfolio',
      name: 'Property Portfolio',
      description: 'Property managers with larger portfolios',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'property-portfolio-monthly',
          name: 'Portfolio Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.property_portfolio_monthly,
              name: 'Property Portfolio',
              cost: 29,
              type: 'flat',
            },
          ],
        },
        {
          id: 'property-portfolio-yearly',
          name: 'Portfolio Yearly',
          paymentType: 'recurring',
          interval: 'year',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.property_portfolio_yearly,
              name: 'Property Portfolio',
              cost: 290,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Up to 20 properties',
        'Bulk tenant & maintenance workflows',
        'Portfolio finances & reporting',
        'Document vault per property',
      ],
    },
    {
      id: 'ozer-commercial-property',
      name: 'Commercial Property',
      description:
        'Graduated per-seat pricing for commercial agencies — instructions, requirements, and marketing',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      highlighted: true,
      badge: 'Published pricing',
      plans: [
        {
          id: 'commercial-property-monthly',
          name: 'Commercial Property Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.commercial_property_monthly,
              name: 'Billable seat',
              cost: 89,
              type: 'per_seat',
              unit: 'seat',
              description:
                'Graduated: £89 for seat 1, £55 for seats 2–7, £39 for seats 8+',
              tiers: [
                { upTo: 1, cost: 89 },
                { upTo: 7, cost: 55 },
                { upTo: 'unlimited', cost: 39 },
              ],
            },
          ],
        },
      ],
      features: [
        'Graduated per-seat pricing (from £89/mo)',
        'Listings, pipeline & requirements',
        'Free support seats on Team and Scale sizes',
        'Portal publishing (Rightmove, EACH, Property Hive)',
        'Online brochures & branded presentations',
      ],
    },
    {
      id: 'ozer-addon-portal-publishing',
      name: 'Portal Publishing',
      description:
        'Publish commercial listings to Rightmove, EACH, and Property Hive',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'portal-publishing-monthly',
          name: 'Portal Publishing Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_portal_publishing_monthly,
              name: 'Portal Publishing',
              cost: 79,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Rightmove RTDF feed (coming soon)',
        'EACH portal (coming soon)',
        'Property Hive WordPress sync',
      ],
    },
    {
      id: 'ozer-addon-email-assistant',
      name: 'Email Assistant',
      description:
        'Gmail inbox sync, AI action items, and draft replies in your personal Ozer',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'email-assistant-monthly',
          name: 'Email Assistant Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_email_assistant_monthly,
              name: 'Email Assistant',
              cost: 9,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Gmail inbox sync',
        'AI suggested to-dos from threads',
        'Draft replies in your voice',
        'Accept actions into Ozer tasks',
      ],
    },
    {
      id: 'ozer-addon-signatures',
      name: 'Signatures',
      description:
        'Flat-tier branded email signatures for Microsoft 365 and Google Workspace',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'signatures-starter-monthly',
          name: 'Signatures Starter Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_signatures_starter_monthly,
              name: 'Signatures Starter',
              cost: 9,
              type: 'flat',
            },
          ],
        },
        {
          id: 'signatures-starter-yearly',
          name: 'Signatures Starter Annual',
          paymentType: 'recurring',
          interval: 'year',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_signatures_starter_yearly,
              name: 'Signatures Starter',
              cost: 90,
              type: 'flat',
            },
          ],
        },
        {
          id: 'signatures-team-monthly',
          name: 'Signatures Team Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_signatures_team_monthly,
              name: 'Signatures Team',
              cost: 19,
              type: 'flat',
            },
          ],
        },
        {
          id: 'signatures-team-yearly',
          name: 'Signatures Team Annual',
          paymentType: 'recurring',
          interval: 'year',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_signatures_team_yearly,
              name: 'Signatures Team',
              cost: 190,
              type: 'flat',
            },
          ],
        },
        {
          id: 'signatures-office-monthly',
          name: 'Signatures Office Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_signatures_office_monthly,
              name: 'Signatures Office',
              cost: 39,
              type: 'flat',
            },
          ],
        },
        {
          id: 'signatures-office-yearly',
          name: 'Signatures Office Annual',
          paymentType: 'recurring',
          interval: 'year',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_signatures_office_yearly,
              name: 'Signatures Office',
              cost: 390,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Unlimited templates',
        'Microsoft 365 & Google Workspace deployment',
        'Per-staff personalisation',
        'Campaign banners',
      ],
    },
    {
      id: 'ozer-addon-site-studio',
      name: 'Site Studio',
      description:
        'AI website planning: brief, canvas sitemap, wireframes, style system, SEO/AEO, and export packs',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'site-studio-monthly',
          name: 'Site Studio Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_site_studio_monthly,
              name: 'Site Studio',
              cost: 19,
              type: 'flat',
            },
          ],
        },
        {
          id: 'site-studio-yearly',
          name: 'Site Studio Annual',
          paymentType: 'recurring',
          interval: 'year',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_site_studio_yearly,
              name: 'Site Studio',
              cost: 190,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'AI brief from notes or a URL',
        'Canvas sitemap with repeating components',
        'Wireframes with section library',
        'Style system + moodboard',
        'SEO / GEO / AEO per page + llms.txt',
        'Export: Webflow Client-First, Astro, Next.js, Cursor prompts',
        'Client portal + public share links',
      ],
    },
    {
      id: 'ozer-addon-rankly',
      name: 'Rankly',
      description:
        'SEO rankings, PageSpeed scheduling, AI insights, and keyword research',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'rankly-monthly',
          name: 'Rankly Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_rankly_monthly,
              name: 'Rankly',
              cost: 36,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Rank tracking & alerts',
        'Scheduled PageSpeed Insights',
        'Notifications on score drops',
        'AI insights & audits',
        'Site explorer & briefs',
        'Backlinks (coming soon)',
      ],
    },
    {
      id: 'ozer-addon-feedflow',
      name: 'Feedflow',
      description: 'Reviews and social content for your brand',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'feedflow-monthly',
          name: 'Feedflow Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_feedflow_monthly,
              name: 'Feedflow',
              cost: 9,
              type: 'flat',
            },
          ],
        },
      ],
      features: ['Review widgets', 'Social accounts', 'Video snippets'],
    },
    {
      id: 'ozer-addon-videos-starter',
      name: 'Videos Starter',
      description: 'Hosted video for small libraries',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'videos-starter-monthly',
          name: 'Videos Starter',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_videos_starter_monthly,
              name: 'Videos (1–5)',
              cost: 5,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Up to 5 hosted videos',
        'Private & public visibility',
        'Shareable public watch links',
        'Custom branded player presets',
        'Iframe, HTML5 & JS embed codes',
        'Webflow, WordPress & any CMS',
      ],
    },
    {
      id: 'ozer-addon-videos-growth',
      name: 'Videos Growth',
      description: 'Growing video libraries with analytics',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'videos-growth-monthly',
          name: 'Videos Growth',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_videos_growth_monthly,
              name: 'Videos (6–20)',
              cost: 12,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Up to 20 hosted videos',
        'Private & public visibility',
        'Shareable public watch links',
        'Custom branded player presets',
        'Iframe, HTML5 & JS embed codes',
        'Webflow, WordPress & any CMS',
        'View analytics',
      ],
    },
    {
      id: 'ozer-addon-videos-pro',
      name: 'Videos Pro',
      description: 'Professional video hosting with full player control',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'videos-pro-monthly',
          name: 'Videos Pro',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_videos_pro_monthly,
              name: 'Videos (21–49)',
              cost: 29,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Up to 49 hosted videos',
        'Private & public visibility',
        'Shareable public watch links',
        'Custom branded player presets',
        'Iframe, HTML5 & JS embed codes',
        'Webflow, WordPress & any CMS',
      ],
    },
    {
      id: 'ozer-addon-videos-studio',
      name: 'Videos Studio',
      description: 'Large video libraries with priority encoding',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: true,
      plans: [
        {
          id: 'videos-studio-monthly',
          name: 'Videos Studio',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.addon_videos_studio_monthly,
              name: 'Videos (50–100)',
              cost: 47,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Up to 100 hosted videos',
        'Private & public visibility',
        'Shareable public watch links',
        'Custom branded player presets',
        'Iframe, HTML5 & JS embed codes',
        'Webflow, WordPress & any CMS',
        'Priority encoding',
      ],
    },
    {
      id: 'ozer-ai-credits-boost',
      name: 'AI credits — Boost',
      description: '2,000 extra AI credits for your workspace',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: false,
      plans: [
        {
          id: 'ai-credits-boost',
          name: 'Boost (one-time)',
          paymentType: 'one-time',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.ai_credits_boost,
              name: '2,000 AI credits',
              cost: 5,
              type: 'flat',
            },
          ],
        },
        {
          id: 'ai-credits-boost-monthly',
          name: 'Boost (monthly)',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.ai_credits_boost_monthly,
              name: '2,000 AI credits / month',
              cost: 5,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        '2,000 AI credits',
        'Purchased credits roll over when your monthly pool resets',
      ],
    },
    {
      id: 'ozer-ai-credits-studio',
      name: 'AI credits — Studio',
      description: '5,000 extra AI credits for your workspace',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: false,
      plans: [
        {
          id: 'ai-credits-studio',
          name: 'Studio (one-time)',
          paymentType: 'one-time',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.ai_credits_studio,
              name: '5,000 AI credits',
              cost: 10,
              type: 'flat',
            },
          ],
        },
        {
          id: 'ai-credits-studio-monthly',
          name: 'Studio (monthly)',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.ai_credits_studio_monthly,
              name: '5,000 AI credits / month',
              cost: 10,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        '5,000 AI credits',
        'Purchased credits roll over when your monthly pool resets',
      ],
    },
    {
      id: 'ozer-ai-credits-agency',
      name: 'AI credits — Agency',
      description: '12,000 extra AI credits for your workspace',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: false,
      plans: [
        {
          id: 'ai-credits-agency',
          name: 'Agency (one-time)',
          paymentType: 'one-time',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.ai_credits_agency,
              name: '12,000 AI credits',
              cost: 20,
              type: 'flat',
            },
          ],
        },
        {
          id: 'ai-credits-agency-monthly',
          name: 'Agency (monthly)',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.ai_credits_agency_monthly,
              name: '12,000 AI credits / month',
              cost: 20,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        '12,000 AI credits',
        'Purchased credits roll over when your monthly pool resets',
      ],
    },
    {
      id: 'ozer-addon-media-starter',
      name: 'Media Generate — Starter',
      description: '220 media units / month for AI image & video generation',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: false,
      plans: [
        {
          id: 'media-starter-monthly',
          name: 'Starter (monthly)',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.media_starter_monthly,
              name: '220 media units / month',
              cost: 5,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        '220 media units each billing cycle',
        'Unused monthly units do not roll over',
      ],
    },
    {
      id: 'ozer-addon-media-studio',
      name: 'Media Generate — Studio',
      description: '600 media units / month for AI image & video generation',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: false,
      plans: [
        {
          id: 'media-studio-monthly',
          name: 'Studio (monthly)',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.media_studio_monthly,
              name: '600 media units / month',
              cost: 14,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        '600 media units each billing cycle',
        'Unused monthly units do not roll over',
      ],
    },
    {
      id: 'ozer-addon-media-agency',
      name: 'Media Generate — Agency',
      description: '1,500 media units / month for AI image & video generation',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: false,
      plans: [
        {
          id: 'media-agency-monthly',
          name: 'Agency (monthly)',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.media_agency_monthly,
              name: '1,500 media units / month',
              cost: 35,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        '1,500 media units each billing cycle',
        'Unused monthly units do not roll over',
      ],
    },
    {
      id: 'ozer-media-topup-small',
      name: 'Media top-up — Small',
      description: '200 media units (expire 6 months from purchase)',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: false,
      plans: [
        {
          id: 'media-topup-small',
          name: 'Small top-up',
          paymentType: 'one-time',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.media_topup_small,
              name: '200 media units',
              cost: 7.5,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        '200 media units',
        'Expires 6 months from purchase',
        'Works without a monthly media plan',
      ],
    },
    {
      id: 'ozer-media-topup-large',
      name: 'Media top-up — Large',
      description: '500 media units (expire 6 months from purchase)',
      currency: OZER_BILLING_CURRENCY,
      enableDiscountField: false,
      plans: [
        {
          id: 'media-topup-large',
          name: 'Large top-up',
          paymentType: 'one-time',
          lineItems: [
            {
              id: OZER_STRIPE_PRICES.media_topup_large,
              name: '500 media units',
              cost: 20,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        '500 media units',
        'Expires 6 months from purchase',
        'Works without a monthly media plan',
      ],
    },
  ],
});
