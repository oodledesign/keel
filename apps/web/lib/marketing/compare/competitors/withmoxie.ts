import { OZER_TEAM_OF_FOUR } from '~/lib/marketing/compare/ozer-baseline';
import type {
  ComparisonConfig,
  SourcedValue,
} from '~/lib/marketing/compare/types';

function c<T>(
  value: T,
  sourceUrl: string,
  lastVerified: string,
  verified = false,
): SourcedValue<T> {
  return { value, sourceUrl, lastVerified, verified };
}

export const withmoxieComparison: ComparisonConfig = {
  slug: 'withmoxie',
  competitorName: 'Moxie',
  competitorShortName: 'Moxie',
  seo: {
    title: 'Moxie alternatives (2026): honest UK comparison',
    description:
      'Moxie vs Ozer for a 4-person UK studio: flat monthly tiers, seat ceilings, phone-feature geography, and who each product suits.',
    keywords: [
      'Moxie alternative',
      'Moxie alternative UK',
      'Moxie pricing',
      'Moxie vs Ozer',
      'withmoxie alternative',
    ],
  },
  inBrief: [
    'Moxie (withmoxie.com) sells flat monthly plans for freelancers and small teams, with a published seat ceiling on its Teams tier.',
    'Ozer is a Workspace OS with flat team pricing, EU data residency, and Mac meeting capture without permanent audio storage.',
    'Choose Moxie if its flat tiers and feature set fit and you accept geographic limits on some features; choose Ozer if you need EU residency and a broader workspace model.',
  ],
  glanceRows: [
    {
      id: 'pricingModel',
      label: 'Pricing model',
      competitor: c(
        'Flat monthly plans commonly cited around $12 / $25 / $40 (confirm live tiers)',
        'https://www.withmoxie.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.pricingModel,
    },
    {
      id: 'teamOfFourGbpYear',
      label: 'Price for a 4-person team (£/year)',
      competitor: c(
        'Illustrative Teams tier annualised USD→GBP (5-seat ceiling on Teams — confirm)',
        'https://www.withmoxie.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.teamOfFourGbpYear,
    },
    {
      id: 'transactionFees',
      label: 'Transaction fees',
      competitor: c(
        'Payment processing fees may apply — confirm on Moxie billing docs',
        'https://www.withmoxie.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.transactionFees,
    },
    {
      id: 'meetingIntelligence',
      label: 'Meeting intelligence',
      competitor: c(
        'Not primarily positioned as on-device Mac meeting transcription',
        'https://www.withmoxie.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.meetingIntelligence,
    },
    {
      id: 'emailIntegration',
      label: 'Email integration',
      competitor: c(
        'Client and business communication features in-product (confirm scope)',
        'https://www.withmoxie.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.emailIntegration,
    },
    {
      id: 'clientPortal',
      label: 'Client portal',
      competitor: c(
        'Client-facing experience for documents and projects (confirm depth)',
        'https://www.withmoxie.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.clientPortal,
    },
    {
      id: 'dataResidency',
      label: 'Data residency',
      competitor: c(
        'Confirm hosting regions in Moxie privacy documentation',
        'https://www.withmoxie.com/privacy',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.dataResidency,
    },
    {
      id: 'compliancePosture',
      label: 'UK/EU compliance posture',
      competitor: c(
        'Phone features often limited to US/CA/UK — review full compliance docs for EU clients',
        'https://www.withmoxie.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.compliancePosture,
    },
    {
      id: 'freeTrial',
      label: 'Free trial',
      competitor: c(
        'Trial availability changes — confirm on current pricing page',
        'https://www.withmoxie.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.freeTrial,
    },
  ],
  pricingMaths: {
    heading: 'The pricing maths',
    intro:
      'Worked example for a 4-person UK studio. Moxie Teams is often described with a 5-seat ceiling; flat $40/mo is used illustratively. USD→GBP at £0.79 per $1.',
    competitorLines: [
      {
        label: 'Teams tier ($40/mo) × 12',
        amountGbp: c(379, 'https://www.withmoxie.com/pricing', '2026-07-04'),
        note: '$40 × 12 × 0.79 ≈ £379 — confirm seat limit covers four people',
      },
      {
        label: 'Estimated payment processing on £40,000 (illustrative)',
        amountGbp: c(1160, 'https://www.withmoxie.com/pricing', '2026-07-04'),
      },
    ],
    competitorTotalGbp: c(
      1539,
      'https://www.withmoxie.com/pricing',
      '2026-07-04',
    ),
    ozerLines: [
      {
        label: 'Business Team annual (up to 5 members)',
        amountGbp: OZER_TEAM_OF_FOUR.teamOfFourAnnualGbp,
      },
      {
        label: 'Stripe fees on client invoices (same volume assumption)',
        amountGbp: c(1160, 'https://stripe.com/gb/pricing', '2026-07-04'),
      },
    ],
    ozerTotalGbp: c(1950, 'https://ozer.so/pricing', '2026-07-04'),
    footnotes: [
      {
        text: 'Public materials often list Moxie at about $12 / $25 / $40 monthly with a Teams seat ceiling around five users — verify live limits.',
        sourceUrl: 'https://www.withmoxie.com/pricing',
        lastVerified: '2026-07-04',
        verified: false,
      },
      {
        text: 'Phone-related features are frequently limited to US, Canada, and the UK — confirm if you operate elsewhere.',
        sourceUrl: 'https://www.withmoxie.com/',
        lastVerified: '2026-07-04',
        verified: false,
      },
    ],
  },
  chooseCompetitorIf: [
    'Moxie’s flat tiers cover your headcount (including any Teams seat ceiling) and you like its freelance feature mix.',
    'You operate mainly in markets where Moxie’s phone and telephony features are supported.',
    'You do not need EU data residency as a hard requirement.',
  ],
  chooseOzerIf: [
    'You want flat team pricing with a clear Business Team band (up to five members) and a UK Trust Centre.',
    'You need EU data residency for client commitments.',
    'You want Mac meeting transcription processed on-device without permanent audio files.',
    'You want personal and business workspaces connected in one Workspace OS.',
  ],
  faqs: [
    {
      question: 'Is Moxie worth it in 2026?',
      answer:
        'It can be if flat monthly pricing and Moxie’s modules fit your studio and you stay within seat limits. Check telephony geography and hosting if you serve EU clients.',
    },
    {
      question: "What's the best Moxie alternative in the UK?",
      answer:
        'Ozer is one option for UK studios that want EU residency, flat team pricing, and Mac meeting capture. Others may fit if you only need a lightweight freelance CRM.',
    },
    {
      question: 'How many seats does Moxie Teams include?',
      answer:
        'Public materials often cite a five-seat ceiling on Teams — confirm on the live pricing page before modelling a four-person team.',
    },
    {
      question: 'Does Ozer include phone features like Moxie?',
      answer:
        'Ozer focuses on workspace operations, email assist, and Mac meeting capture rather than a full telephony stack. Compare the modules you actually use.',
    },
    {
      question: 'Is Moxie available for EU teams?',
      answer:
        'Product availability and phone features can be region-limited. Read current Moxie docs for your country before committing.',
    },
  ],
  migrationNote:
    'Moving from Moxie means exporting clients and open work, recreating projects and invoices in Ozer, and inviting the team to Business Team. If you rely on Moxie phone features, plan a parallel channel before cutover.',
  relatedFeatures: [
    { href: '/features/invoicing', label: 'Ozer invoicing' },
    { href: '/features/project-management', label: 'Ozer projects' },
    { href: '/features/client-portals', label: 'Ozer client portals' },
    { href: '/features/desktop-assistant', label: 'Ozer Assistant for Mac' },
    { href: '/features/activity', label: 'Ozer activity tracking' },
    { href: '/pricing', label: 'Ozer pricing' },
  ],
};
