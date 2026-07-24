export type AdminSubprocessorCategory =
  | 'Infrastructure'
  | 'Payments'
  | 'AI'
  | 'Google & Microsoft'
  | 'Communications'
  | 'Media & SEO'
  | 'Finance integrations';

export type AdminSubprocessor = {
  id: string;
  name: string;
  purpose: string;
  category: AdminSubprocessorCategory;
  href: string;
  /** Domain used for favicon / logo lookup */
  logoDomain: string;
  /** Formal GDPR sub-processor listed on the trust centre */
  isSubprocessor: boolean;
};

/**
 * Operational vendors and formal sub-processors used by Ozer.
 * Keep in sync with Trust Centre / privacy inventory when the public list changes.
 */
export const ADMIN_SUBPROCESSORS: AdminSubprocessor[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    purpose: 'Database, auth, storage (EU West / AWS Ireland)',
    category: 'Infrastructure',
    href: 'https://supabase.com',
    logoDomain: 'supabase.com',
    isSubprocessor: true,
  },
  {
    id: 'aws',
    name: 'Amazon Web Services',
    purpose: 'Infrastructure behind Supabase hosting',
    category: 'Infrastructure',
    href: 'https://aws.amazon.com',
    logoDomain: 'aws.amazon.com',
    isSubprocessor: true,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    purpose: 'App hosting, edge, crons, and deployments',
    category: 'Infrastructure',
    href: 'https://vercel.com',
    logoDomain: 'vercel.com',
    isSubprocessor: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    purpose: 'SaaS billing and Stripe Connect payments',
    category: 'Payments',
    href: 'https://stripe.com',
    logoDomain: 'stripe.com',
    isSubprocessor: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    purpose: 'LLM features (briefs, email, transcripts, Rankly AI)',
    category: 'AI',
    href: 'https://www.anthropic.com',
    logoDomain: 'anthropic.com',
    isSubprocessor: true,
  },
  {
    id: 'voyage',
    name: 'Voyage AI',
    purpose: 'Embeddings for Second Brain (when configured)',
    category: 'AI',
    href: 'https://www.voyageai.com',
    logoDomain: 'voyageai.com',
    isSubprocessor: true,
  },
  {
    id: 'soniox',
    name: 'Soniox',
    purpose: 'Cloud realtime speech-to-text (web recorder path)',
    category: 'AI',
    href: 'https://soniox.com',
    logoDomain: 'soniox.com',
    isSubprocessor: true,
  },
  {
    id: 'google',
    name: 'Google',
    purpose:
      'Gmail, Calendar, Search Console, Workspace APIs, PageSpeed, Gemini',
    category: 'Google & Microsoft',
    href: 'https://cloud.google.com',
    logoDomain: 'google.com',
    isSubprocessor: true,
  },
  {
    id: 'microsoft',
    name: 'Microsoft Graph',
    purpose: 'Signatures directory and mailbox settings',
    category: 'Google & Microsoft',
    href: 'https://learn.microsoft.com/en-us/graph/overview',
    logoDomain: 'microsoft.com',
    isSubprocessor: true,
  },
  {
    id: 'zeptomail',
    name: 'ZeptoMail',
    purpose: 'Transactional email (EU API endpoint)',
    category: 'Communications',
    href: 'https://www.zoho.com/zeptomail/',
    logoDomain: 'zoho.com',
    isSubprocessor: true,
  },
  {
    id: 'bunny',
    name: 'Bunny.net',
    purpose: 'Video hosting (Stream)',
    category: 'Media & SEO',
    href: 'https://bunny.net',
    logoDomain: 'bunny.net',
    isSubprocessor: true,
  },
  {
    id: 'dataforseo',
    name: 'DataForSEO',
    purpose: 'Rankly SERP ranks, keyword metrics, and research APIs',
    category: 'Media & SEO',
    href: 'https://dataforseo.com',
    logoDomain: 'dataforseo.com',
    isSubprocessor: false,
  },
  {
    id: 'freeagent',
    name: 'FreeAgent',
    purpose: 'Accounting sync for finances (when connected)',
    category: 'Finance integrations',
    href: 'https://www.freeagent.com',
    logoDomain: 'freeagent.com',
    isSubprocessor: false,
  },
  {
    id: 'starling',
    name: 'Starling Bank',
    purpose: 'Bank feed sync for finances (when connected)',
    category: 'Finance integrations',
    href: 'https://www.starlingbank.com',
    logoDomain: 'starlingbank.com',
    isSubprocessor: false,
  },
];

export const ADMIN_SUBPROCESSOR_CATEGORIES: AdminSubprocessorCategory[] = [
  'Infrastructure',
  'Payments',
  'AI',
  'Google & Microsoft',
  'Communications',
  'Media & SEO',
  'Finance integrations',
];
