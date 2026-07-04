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

/**
 * Hello Bonsai comparison shell.
 * Competitor figures are unverified until you set verified: true after checking sources.
 */
export const hellobonsaiComparison: ComparisonConfig = {
  slug: 'hellobonsai',
  competitorName: 'Hello Bonsai',
  competitorShortName: 'Bonsai',
  seo: {
    title: 'Hello Bonsai alternatives (2026): honest UK comparison',
    description:
      'Hello Bonsai vs Ozer for a 4-person UK studio: per-user pricing, annualised £ costs, meeting tools, and who each product suits. Neutral review.',
    keywords: [
      'Hello Bonsai alternative',
      'Hello Bonsai alternative UK',
      'Hello Bonsai pricing',
      'Hello Bonsai vs Ozer',
      'Bonsai alternative 2026',
    ],
  },
  inBrief: [
    'Hello Bonsai is a freelance operations suite with proposals, contracts, and invoicing, sold primarily on per-user plans.',
    'Ozer is a Workspace OS with flat team pricing, EU data residency, and Mac meeting capture that does not keep permanent audio.',
    'Choose Bonsai if you want a US-centric freelance stack and accept per-seat cost; choose Ozer if a 4-person UK studio wants one flat workspace price and EU-hosted data.',
  ],
  glanceRows: [
    {
      id: 'pricingModel',
      label: 'Pricing model',
      competitor: c(
        'Per-user monthly tiers (annual billing options); public tiers commonly cited from about $9–$49 per user per month',
        'https://www.hellobonsai.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.pricingModel,
    },
    {
      id: 'teamOfFourGbpYear',
      label: 'Price for a 4-person team (£/year)',
      competitor: c(
        'Illustrative: 4 × mid-tier annualised USD converted to GBP (see pricing maths; verify current tier)',
        'https://www.hellobonsai.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.teamOfFourGbpYear,
    },
    {
      id: 'transactionFees',
      label: 'Transaction fees',
      competitor: c(
        'Payment processing fees apply on collected invoices (confirm current rates on Bonsai billing docs)',
        'https://www.hellobonsai.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.transactionFees,
    },
    {
      id: 'meetingIntelligence',
      label: 'Meeting intelligence',
      competitor: c(
        'Not positioned as on-device Mac meeting transcription (confirm current product surface)',
        'https://www.hellobonsai.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.meetingIntelligence,
    },
    {
      id: 'emailIntegration',
      label: 'Email integration',
      competitor: c(
        'Email and client communication features in the freelance suite (scope varies by plan)',
        'https://www.hellobonsai.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.emailIntegration,
    },
    {
      id: 'clientPortal',
      label: 'Client portal',
      competitor: c(
        'Client-facing forms and document flows (portal depth depends on plan)',
        'https://www.hellobonsai.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.clientPortal,
    },
    {
      id: 'dataResidency',
      label: 'Data residency',
      competitor: c(
        'Confirm current hosting regions in Bonsai privacy / security documentation',
        'https://www.hellobonsai.com/privacy',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.dataResidency,
    },
    {
      id: 'compliancePosture',
      label: 'UK/EU compliance posture',
      competitor: c(
        'US-origin product; review DPA and transfer mechanisms for UK/EU clients',
        'https://www.hellobonsai.com/privacy',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.compliancePosture,
    },
    {
      id: 'freeTrial',
      label: 'Free trial',
      competitor: c(
        'Trial / free options have changed over time — confirm on current pricing page',
        'https://www.hellobonsai.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.freeTrial,
    },
  ],
  pricingMaths: {
    heading: 'The pricing maths',
    intro:
      'Worked example for a 4-person UK studio. Competitor USD list prices are annualised and converted at £0.79 per $1 for illustration only — replace with your verified rate and tier before publish.',
    competitorLines: [
      {
        label: '4 seats × illustrative mid-tier ($29/user/mo annual)',
        amountGbp: c(1097, 'https://www.hellobonsai.com/pricing', '2026-07-04'),
        note: '4 × $29 × 12 × 0.79 ≈ £1,097',
      },
      {
        label: 'Estimated card fees on £40,000 client payments (illustrative)',
        amountGbp: c(1160, 'https://www.hellobonsai.com/pricing', '2026-07-04'),
        note: 'Replace with Bonsai’s published processing rates × your volume',
      },
    ],
    competitorTotalGbp: c(2257, 'https://www.hellobonsai.com/pricing', '2026-07-04'),
    ozerLines: [
      {
        label: 'Business Team annual (up to 5 members)',
        amountGbp: OZER_TEAM_OF_FOUR.teamOfFourAnnualGbp,
      },
      {
        label: 'Stripe fees on client invoices (same volume assumption)',
        amountGbp: c(1160, 'https://stripe.com/gb/pricing', '2026-07-04'),
        note: 'Stripe UK card pricing; not an Ozer platform fee',
      },
    ],
    ozerTotalGbp: c(1950, 'https://ozer.so/pricing', '2026-07-04'),
    footnotes: [
      {
        text: 'Bonsai public tiers are often described in the $9–$49 per user per month range on annual billing; confirm live tiers before citing.',
        sourceUrl: 'https://www.hellobonsai.com/pricing',
        lastVerified: '2026-07-04',
        verified: false,
      },
      {
        text: 'Pending acquisition or ownership changes can affect roadmap and pricing — treat as uncertainty, not a settled fact, until verified.',
        sourceUrl: 'https://www.hellobonsai.com/',
        lastVerified: '2026-07-04',
        verified: false,
      },
      {
        text: 'FX conversion £0.79 per $1 is illustrative for this page shell only.',
        sourceUrl: 'https://ozer.so/compare/hellobonsai',
        lastVerified: '2026-07-04',
        verified: false,
      },
    ],
  },
  chooseCompetitorIf: [
    'You want a freelance-first US product and are comfortable with per-user pricing as the team grows.',
    'Your workflows already centre on Bonsai proposals, contracts, and invoices and switching cost is high.',
    'You do not need EU data residency or on-device Mac meeting capture as hard requirements.',
  ],
  chooseOzerIf: [
    'You want a flat price for the whole team (Business Team covers up to five members) rather than multiplying seats.',
    'You need EU data residency and a UK-built product with a published Trust Centre.',
    'You want Mac meeting transcription processed on-device without keeping permanent audio files.',
    'You want personal, family, and business workspaces in one Workspace OS — not only a freelance CRM silo.',
  ],
  faqs: [
    {
      question: 'Is Hello Bonsai worth it in 2026?',
      answer:
        'It can be, if per-user pricing fits your headcount and you are happy with Bonsai’s feature set and hosting posture. For a growing UK studio, annual seat cost and any ownership uncertainty are the main checks before renewing.',
    },
    {
      question: "What's the best Hello Bonsai alternative in the UK?",
      answer:
        'There is no single best alternative. Ozer is built for UK/EU studios that want flat team pricing, EU residency, and Mac meeting capture. Other tools may fit if you prioritise different modules or US-centric ecosystems.',
    },
    {
      question: 'How does Hello Bonsai pricing compare to Ozer for four people?',
      answer:
        'Bonsai charges per user; Ozer Business Team is a flat workspace price for up to five members (£790/year on annual billing). Run the pricing maths section with verified Bonsai tiers and FX before deciding.',
    },
    {
      question: 'Does Ozer replace Hello Bonsai proposals and contracts?',
      answer:
        'Ozer includes contracts, invoices, pipeline, and projects in the business workspace. Map your Bonsai templates before migrating; the migration note below lists the practical steps.',
    },
    {
      question: 'Where is Ozer data hosted compared with Hello Bonsai?',
      answer:
        'Ozer documents EU data residency. Confirm Bonsai’s current regions and transfer mechanisms in their privacy documentation if you serve UK/EU clients.',
    },
  ],
  migrationNote:
    'Moving from Hello Bonsai typically means exporting clients and open invoices, recreating active projects in Ozer, reconnecting Gmail if you use email assist, and inviting the team to one Business Team workspace. Plan a quiet week for template rebuilds (proposals/contracts) rather than a big-bang cutover.',
  relatedFeatures: [
    { href: '/features/invoicing', label: 'Ozer invoicing' },
    { href: '/features/contracts', label: 'Ozer contracts' },
    { href: '/features/pipeline', label: 'Ozer pipeline' },
    { href: '/features/desktop-assistant', label: 'Ozer meeting Assistant for Mac' },
    { href: '/pricing', label: 'Ozer pricing' },
  ],
};
