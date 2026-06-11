import { BillingProviderSchema, createBillingSchema } from '@kit/billing';

import {
  KEEL_BILLING_CURRENCY,
  KEEL_STRIPE_PRICES,
} from '~/lib/billing/stripe-price-ids';

const provider = BillingProviderSchema.parse(
  process.env.NEXT_PUBLIC_BILLING_PROVIDER,
);

const TRIAL_DAYS = 14;

export default createBillingSchema({
  provider,
  products: [
    {
      id: 'keel-community',
      name: 'Community',
      description: 'Groups, schedules, and shared tasks for clubs and homegroups',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'community-monthly',
          name: 'Community Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.community_monthly,
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
              id: KEEL_STRIPE_PRICES.community_yearly,
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
      id: 'keel-business-solo',
      name: 'Business Solo',
      description: 'Full business workspace for one person',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'business-solo-monthly',
          name: 'Solo Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.business_solo_monthly,
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
              id: KEEL_STRIPE_PRICES.business_solo_yearly,
              name: 'Business Solo',
              cost: 290,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Clients, jobs, invoices & tasks',
        '1 team member (you)',
        'Docs, finances & pipeline',
      ],
    },
    {
      id: 'keel-business-team',
      name: 'Business Team',
      highlighted: true,
      badge: 'Popular',
      description: 'Collaborate with a small team',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'business-team-monthly',
          name: 'Team Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.business_team_monthly,
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
              id: KEEL_STRIPE_PRICES.business_team_yearly,
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
        'Shared client & project work',
      ],
    },
    {
      id: 'keel-business-scale',
      name: 'Business Scale',
      description: 'Larger teams with more seats',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'business-scale-monthly',
          name: 'Scale Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.business_scale_monthly,
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
              id: KEEL_STRIPE_PRICES.business_scale_yearly,
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
        'Priority support',
      ],
    },
    {
      id: 'keel-property-starter',
      name: 'Property Starter',
      description: 'Landlords and small portfolios',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'property-starter-monthly',
          name: 'Starter Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.property_starter_monthly,
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
              id: KEEL_STRIPE_PRICES.property_starter_yearly,
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
      id: 'keel-property-portfolio',
      name: 'Property Portfolio',
      description: 'Property managers with larger portfolios',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'property-portfolio-monthly',
          name: 'Portfolio Monthly',
          paymentType: 'recurring',
          interval: 'month',
          trialDays: TRIAL_DAYS,
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.property_portfolio_monthly,
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
              id: KEEL_STRIPE_PRICES.property_portfolio_yearly,
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
      id: 'keel-addon-rankly',
      name: 'Rankly',
      description: 'SEO rankings, PageSpeed, and keyword research',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'rankly-monthly',
          name: 'Rankly Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.addon_rankly_monthly,
              name: 'Rankly',
              cost: 36,
              type: 'flat',
            },
          ],
        },
      ],
      features: ['Rank tracking', 'PageSpeed scans', 'Site explorer & briefs'],
    },
    {
      id: 'keel-addon-feedflow',
      name: 'Feedflow',
      description: 'Reviews and social content for your brand',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'feedflow-monthly',
          name: 'Feedflow Monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.addon_feedflow_monthly,
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
      id: 'keel-addon-videos-starter',
      name: 'Videos Starter',
      description: 'Hosted video for small libraries',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'videos-starter-monthly',
          name: 'Videos Starter',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.addon_videos_starter_monthly,
              name: 'Videos (1–5)',
              cost: 5,
              type: 'flat',
            },
          ],
        },
      ],
      features: ['Up to 5 hosted videos', 'Embeds & presets'],
    },
    {
      id: 'keel-addon-videos-growth',
      name: 'Videos Growth',
      description: 'Growing video libraries',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'videos-growth-monthly',
          name: 'Videos Growth',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.addon_videos_growth_monthly,
              name: 'Videos (6–20)',
              cost: 12,
              type: 'flat',
            },
          ],
        },
      ],
      features: ['Up to 20 hosted videos', 'Analytics & presets'],
    },
    {
      id: 'keel-addon-videos-pro',
      name: 'Videos Pro',
      description: 'Professional video hosting',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'videos-pro-monthly',
          name: 'Videos Pro',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.addon_videos_pro_monthly,
              name: 'Videos (21–49)',
              cost: 29,
              type: 'flat',
            },
          ],
        },
      ],
      features: ['Up to 49 hosted videos', 'Custom presets & branding'],
    },
    {
      id: 'keel-addon-videos-studio',
      name: 'Videos Studio',
      description: 'Large video libraries',
      currency: KEEL_BILLING_CURRENCY,
      plans: [
        {
          id: 'videos-studio-monthly',
          name: 'Videos Studio',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: KEEL_STRIPE_PRICES.addon_videos_studio_monthly,
              name: 'Videos (50–100)',
              cost: 47,
              type: 'flat',
            },
          ],
        },
      ],
      features: ['Up to 100 hosted videos', 'Priority encoding'],
    },
  ],
});
