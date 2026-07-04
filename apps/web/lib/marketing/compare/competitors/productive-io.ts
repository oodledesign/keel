import { OZER_TEAM_OF_FOUR } from '~/lib/marketing/compare/ozer-baseline';
import type { ComparisonConfig, SourcedValue } from '~/lib/marketing/compare/types';

function c<T>(
  value: T,
  sourceUrl: string,
  lastVerified: string,
  verified = false,
): SourcedValue<T> {
  return { value, sourceUrl, lastVerified, verified };
}

export const productiveIoComparison: ComparisonConfig = {
  slug: 'productive-io',
  competitorName: 'Productive',
  competitorShortName: 'Productive',
  seo: {
    title: 'Productive.io alternatives (2026): honest UK comparison',
    description:
      'Productive vs Ozer for a 4-person UK studio: per-user PSA pricing, onboarding cost, and who each product suits. Neutral review.',
    keywords: [
      'Productive.io alternative',
      'Productive.io alternative UK',
      'Productive.io pricing',
      'Productive vs Ozer',
      'Productive agency software alternative',
    ],
  },
  inBrief: [
    'Productive is an agency PSA (professional services automation) platform with per-user pricing and deep resourcing, often aimed at larger teams.',
    'Ozer is a Workspace OS for freelancers and small studios with flat team pricing, EU data residency, and Mac meeting capture.',
    'Choose Productive if you need heavy PSA/resourcing for 10+ seats; choose Ozer if a four-person UK studio wants simpler ops without steep onboarding.',
  ],
  glanceRows: [
    {
      id: 'pricingModel',
      label: 'Pricing model',
      competitor: c(
        'Per-user plans commonly cited around $9–$28+ per user per month (confirm live tiers)',
        'https://productive.io/pricing/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.pricingModel,
    },
    {
      id: 'teamOfFourGbpYear',
      label: 'Price for a 4-person team (£/year)',
      competitor: c(
        'Illustrative 4 × mid-tier annualised USD→GBP (see pricing maths)',
        'https://productive.io/pricing/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.teamOfFourGbpYear,
    },
    {
      id: 'transactionFees',
      label: 'Transaction fees',
      competitor: c(
        'Primarily subscription PSA; payment fees depend on how you invoice (confirm)',
        'https://productive.io/pricing/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.transactionFees,
    },
    {
      id: 'meetingIntelligence',
      label: 'Meeting intelligence',
      competitor: c(
        'Not primarily positioned as on-device Mac meeting transcription',
        'https://productive.io/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.meetingIntelligence,
    },
    {
      id: 'emailIntegration',
      label: 'Email integration',
      competitor: c(
        'Agency workflow and communication features (confirm email depth)',
        'https://productive.io/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.emailIntegration,
    },
    {
      id: 'clientPortal',
      label: 'Client portal',
      competitor: c(
        'Client-facing capabilities vary by configuration — confirm for your plan',
        'https://productive.io/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.clientPortal,
    },
    {
      id: 'dataResidency',
      label: 'Data residency',
      competitor: c(
        'Confirm current hosting regions in Productive security documentation',
        'https://productive.io/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.dataResidency,
    },
    {
      id: 'compliancePosture',
      label: 'UK/EU compliance posture',
      competitor: c(
        'Review Productive security and DPA materials for UK/EU clients',
        'https://productive.io/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.compliancePosture,
    },
    {
      id: 'freeTrial',
      label: 'Free trial',
      competitor: c(
        'Trial / demo process — confirm on current Productive pricing page',
        'https://productive.io/pricing/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.freeTrial,
    },
  ],
  pricingMaths: {
    heading: 'The pricing maths',
    intro:
      'Worked example for a 4-person UK studio. Productive is per-user; mid-tier $18/user/mo is illustrative. USD→GBP at £0.79 per $1. Onboarding time is a real cost for PSA tools even when not billed as a line item.',
    competitorLines: [
      {
        label: '4 seats × $18/user/mo × 12',
        amountGbp: c(682, 'https://productive.io/pricing/', '2026-07-04'),
        note: '4 × $18 × 12 × 0.79 ≈ £682 — verify tier',
      },
      {
        label: 'Illustrative onboarding / admin time (internal cost)',
        amountGbp: c(1500, 'https://productive.io/', '2026-07-04'),
        note: 'Not a Productive invoice line — estimate of setup effort for a small studio',
      },
    ],
    competitorTotalGbp: c(2182, 'https://productive.io/pricing/', '2026-07-04'),
    ozerLines: [
      {
        label: 'Business Team annual (up to 5 members)',
        amountGbp: OZER_TEAM_OF_FOUR.teamOfFourAnnualGbp,
      },
      {
        label: 'Stripe fees on client invoices (illustrative volume)',
        amountGbp: c(1160, 'https://stripe.com/gb/pricing', '2026-07-04'),
      },
    ],
    ozerTotalGbp: c(1950, 'https://ozer.so/pricing', '2026-07-04'),
    footnotes: [
      {
        text: 'Public Productive pricing is often described in a roughly $9–$28+ per user per month band — confirm live packages.',
        sourceUrl: 'https://productive.io/pricing/',
        lastVerified: '2026-07-04',
        verified: false,
      },
      {
        text: 'Productive is generally positioned as agency PSA software; many buyers are larger than a four-person studio.',
        sourceUrl: 'https://productive.io/',
        lastVerified: '2026-07-04',
        verified: false,
      },
    ],
  },
  chooseCompetitorIf: [
    'You need deep PSA: resourcing, utilisation, and agency financials for a team heading toward 10+ seats.',
    'You have budget and time for structured onboarding and process change.',
    'Per-user pricing is acceptable because utilisation reporting is the priority.',
  ],
  chooseOzerIf: [
    'You are a freelancer or small UK studio (around four people) and want flat team pricing without PSA complexity.',
    'You need EU data residency and Mac meeting capture without permanent audio files.',
    'You want personal and business workspaces connected, not only agency delivery tooling.',
    'You want to avoid a long implementation project before day-to-day work feels normal.',
  ],
  faqs: [
    {
      question: 'Is Productive worth it in 2026?',
      answer:
        'For agencies that need full PSA and will use resourcing heavily, yes it can be. For a four-person studio, per-user cost and onboarding effort are often the reasons teams look at lighter alternatives.',
    },
    {
      question: "What's the best Productive.io alternative in the UK?",
      answer:
        'Ozer is aimed at smaller UK/EU studios that want a Workspace OS with flat team pricing. Other PSAs may still fit if you need enterprise-style resourcing.',
    },
    {
      question: 'Is Productive overkill for a small studio?',
      answer:
        'Often yes if you only need clients, projects, invoices, and a shared plan. Productive’s strength shows when utilisation and agency finance workflows are central.',
    },
    {
      question: 'How does Productive pricing scale vs Ozer?',
      answer:
        'Productive scales with seats. Ozer Business Team is a flat workspace price up to five members (£790/year on annual billing). Model both with verified list prices.',
    },
    {
      question: 'Does Ozer include time tracking like Productive?',
      answer:
        'Ozer focuses on tasks, projects, invoices, and planning. Compare time-tracking depth if utilisation reporting is mandatory for your agency.',
    },
  ],
  migrationNote:
    'Moving from Productive means exporting clients, projects, and open budgets, then rebuilding active jobs in Ozer. Keep Productive available for historical utilisation reports during the transition month.',
  relatedFeatures: [
    { href: '/features/project-management', label: 'Ozer projects' },
    { href: '/features/tasks', label: 'Ozer tasks' },
    { href: '/features/finances', label: 'Ozer finances' },
    { href: '/features/invoicing', label: 'Ozer invoicing' },
    { href: '/pricing', label: 'Ozer pricing' },
  ],
};
