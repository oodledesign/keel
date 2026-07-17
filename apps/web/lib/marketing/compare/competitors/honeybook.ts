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

export const honeybookComparison: ComparisonConfig = {
  slug: 'honeybook',
  competitorName: 'HoneyBook',
  competitorShortName: 'HoneyBook',
  seo: {
    title: 'HoneyBook alternatives (2026): honest UK comparison',
    description:
      'HoneyBook vs Ozer for a 4-person UK studio: tier pricing, card fees, US-centric product posture, and who each tool suits. Neutral review.',
    keywords: [
      'HoneyBook alternative',
      'HoneyBook alternative UK',
      'HoneyBook pricing',
      'HoneyBook vs Ozer',
      'HoneyBook alternative 2026',
    ],
  },
  inBrief: [
    'HoneyBook is a client-flow platform popular with US creatives, with tiered subscriptions and card processing fees on payments.',
    'Ozer is a UK-built Workspace OS with flat team pricing, EU data residency, and Mac meeting capture without permanent audio storage.',
    'Choose HoneyBook if you want its US client-flow playbook; choose Ozer if UK/EU residency and a flat team price matter more than HoneyBook’s ecosystem.',
  ],
  glanceRows: [
    {
      id: 'pricingModel',
      label: 'Pricing model',
      competitor: c(
        'Tiered plans commonly cited at about $29 / $49 / $109 per month on annual billing (confirm live tiers)',
        'https://www.honeybook.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.pricingModel,
    },
    {
      id: 'teamOfFourGbpYear',
      label: 'Price for a 4-person team (£/year)',
      competitor: c(
        'Illustrative mid/upper tier annualised USD→GBP (see pricing maths)',
        'https://www.honeybook.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.teamOfFourGbpYear,
    },
    {
      id: 'transactionFees',
      label: 'Transaction fees',
      competitor: c(
        'Card fees commonly cited around 2.9% + $0.25 per transaction (confirm current schedule)',
        'https://www.honeybook.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.transactionFees,
    },
    {
      id: 'meetingIntelligence',
      label: 'Meeting intelligence',
      competitor: c(
        'Not primarily positioned as on-device Mac meeting transcription',
        'https://www.honeybook.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.meetingIntelligence,
    },
    {
      id: 'emailIntegration',
      label: 'Email integration',
      competitor: c(
        'Client communication and automation inside HoneyBook flows',
        'https://www.honeybook.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.emailIntegration,
    },
    {
      id: 'clientPortal',
      label: 'Client portal',
      competitor: c(
        'Client experience centred on HoneyBook project flows and files',
        'https://www.honeybook.com/',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.clientPortal,
    },
    {
      id: 'dataResidency',
      label: 'Data residency',
      competitor: c(
        'US-centric product; confirm hosting and transfers for UK/EU clients',
        'https://www.honeybook.com/privacy',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.dataResidency,
    },
    {
      id: 'compliancePosture',
      label: 'UK/EU compliance posture',
      competitor: c(
        'Review HoneyBook DPA and sub-processors for UK GDPR obligations',
        'https://www.honeybook.com/privacy',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.compliancePosture,
    },
    {
      id: 'freeTrial',
      label: 'Free trial',
      competitor: c(
        'Trial offers change — confirm on current HoneyBook pricing page',
        'https://www.honeybook.com/pricing',
        '2026-07-04',
      ),
      ozer: OZER_TEAM_OF_FOUR.freeTrial,
    },
  ],
  pricingMaths: {
    heading: 'The pricing maths',
    intro:
      'Worked example for a 4-person UK studio. HoneyBook tiers are subscription-based (not always strictly per seat); card fees apply on payments. USD converted at £0.79 per $1 for illustration only.',
    competitorLines: [
      {
        label: 'Illustrative Essentials/mid tier ($49/mo annual)',
        amountGbp: c(464, 'https://www.honeybook.com/pricing', '2026-07-04'),
        note: '$49 × 12 × 0.79 ≈ £464 — confirm whether seats are included',
      },
      {
        label: 'Card fees 2.9% + $0.25 on £40,000 volume (illustrative)',
        amountGbp: c(1240, 'https://www.honeybook.com/pricing', '2026-07-04'),
        note: 'Replace with live fee schedule × your volume',
      },
    ],
    competitorTotalGbp: c(
      1704,
      'https://www.honeybook.com/pricing',
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
        text: 'Public commentary in early 2025 described a large Starter-plan price increase (often cited around ~89%). Treat as historical context until you verify HoneyBook’s archive or announcements.',
        sourceUrl: 'https://www.honeybook.com/pricing',
        lastVerified: '2026-07-04',
        verified: false,
      },
      {
        text: 'HoneyBook is widely described as US-centric in product and support posture; confirm for your market.',
        sourceUrl: 'https://www.honeybook.com/',
        lastVerified: '2026-07-04',
        verified: false,
      },
    ],
  },
  chooseCompetitorIf: [
    'Your clients and collaborators already live in HoneyBook’s US creative ecosystem.',
    'You prioritise HoneyBook’s specific client-flow templates over EU residency or flat UK team pricing.',
    'You are comfortable with tier jumps and card fees as part of the total cost of ownership.',
  ],
  chooseOzerIf: [
    'You want a flat price for the whole team rather than tier surprises as you grow.',
    'You need EU data residency and a UK-built Trust Centre narrative for clients.',
    'You want Mac meeting transcription processed on-device without permanent audio retention.',
    'You want business tools connected to personal and family workspaces in one account.',
  ],
  faqs: [
    {
      question: 'Is HoneyBook worth it in 2026?',
      answer:
        'It can be if you rely on its client-flow product and accept subscription tiers plus card fees. After past Starter-plan price changes, UK studios should model total cost carefully before renewing.',
    },
    {
      question: "What's the best HoneyBook alternative in the UK?",
      answer:
        'It depends on requirements. Ozer targets UK/EU studios that want flat team pricing, EU residency, and Mac meeting capture. Other CRMs may fit if you need a US-only stack.',
    },
    {
      question: 'How do HoneyBook fees compare to Ozer?',
      answer:
        'HoneyBook charges a subscription tier plus card processing on payments. Ozer charges a flat workspace subscription; client card fees go to Stripe, not an Ozer platform cut on the subscription.',
    },
    {
      question: 'Is HoneyBook suitable for UK agencies?',
      answer:
        'Some UK freelancers use it successfully, but hosting, support hours, and compliance paperwork may be more US-oriented. Check privacy and DPA details for your clients.',
    },
    {
      question: 'Can Ozer handle proposals and invoices like HoneyBook?',
      answer:
        'Ozer includes pipeline, contracts, invoices, and client portals in the business workspace. Feature depth differs — compare modules you actually use day to day.',
    },
  ],
  migrationNote:
    'Leaving HoneyBook usually means exporting contacts and open projects, rebuilding pipelines and invoice templates in Ozer, and reconnecting payment collection via Stripe. Keep HoneyBook read-only for a billing cycle so historical invoices remain accessible.',
  relatedFeatures: [
    { href: '/features/pipeline', label: 'Ozer pipeline' },
    { href: '/features/invoicing', label: 'Ozer invoicing' },
    { href: '/features/client-portals', label: 'Ozer client portals' },
    { href: '/features/desktop-assistant', label: 'Ozer Assistant for Mac' },
    { href: '/features/activity', label: 'Ozer activity tracking' },
    { href: '/pricing', label: 'Ozer pricing' },
  ],
};
