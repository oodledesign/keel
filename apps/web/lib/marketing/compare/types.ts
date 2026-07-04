/**
 * Comparison page content configs.
 * Every competitor figure must carry sourceUrl + lastVerified.
 * Set verified: false until figures are checked — renders a "verify me" flag in development.
 */

export type SourcedValue<T> = {
  value: T;
  sourceUrl: string;
  lastVerified: string;
  /** When false, UI shows a visible "verify me" flag in development. */
  verified: boolean;
};

export type GlanceRowId =
  | 'pricingModel'
  | 'teamOfFourGbpYear'
  | 'transactionFees'
  | 'meetingIntelligence'
  | 'emailIntegration'
  | 'clientPortal'
  | 'dataResidency'
  | 'compliancePosture'
  | 'freeTrial';

export type GlanceRow = {
  id: GlanceRowId;
  label: string;
  competitor: SourcedValue<string>;
  ozer: SourcedValue<string>;
};

export type PricingMathLine = {
  label: string;
  amountGbp: SourcedValue<number>;
  note?: string;
};

export type PricingMathBlock = {
  heading: string;
  intro: string;
  competitorLines: PricingMathLine[];
  competitorTotalGbp: SourcedValue<number>;
  ozerLines: PricingMathLine[];
  ozerTotalGbp: SourcedValue<number>;
  footnotes: Array<{
    text: string;
    sourceUrl: string;
    lastVerified: string;
    verified: boolean;
  }>;
};

export type ComparisonFaq = {
  question: string;
  answer: string;
};

export type ComparisonConfig = {
  slug: string;
  competitorName: string;
  /** Short name for headings (e.g. Bonsai). */
  competitorShortName: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  inBrief: [string, string, string];
  glanceRows: GlanceRow[];
  pricingMaths: PricingMathBlock;
  chooseCompetitorIf: string[];
  chooseOzerIf: string[];
  faqs: ComparisonFaq[];
  migrationNote: string;
  relatedFeatures: Array<{ href: string; label: string }>;
};

export const GLANCE_ROW_ORDER: GlanceRowId[] = [
  'pricingModel',
  'teamOfFourGbpYear',
  'transactionFees',
  'meetingIntelligence',
  'emailIntegration',
  'clientPortal',
  'dataResidency',
  'compliancePosture',
  'freeTrial',
];
