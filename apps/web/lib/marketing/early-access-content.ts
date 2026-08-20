export type EarlyAccessFeatureStatus = 'live' | 'soon' | 'addon';

export type EarlyAccessAccent =
  | 'cool-blue'
  | 'coral'
  | 'sage'
  | 'lime'
  | 'plum';

export const EARLY_ACCESS_ACCENT_CLASS: Record<EarlyAccessAccent, string> = {
  'cool-blue': 'bg-[var(--ozer-cool-blue)]',
  coral: 'bg-[var(--ozer-accent)]',
  sage: 'bg-[var(--ozer-sage-500)]',
  lime: 'bg-[var(--ozer-lime-400)]',
  plum: 'bg-[var(--ozer-plum-600)]',
};

export const EARLY_ACCESS_ACCENT_TEXT_CLASS: Record<EarlyAccessAccent, string> =
  {
    'cool-blue': 'text-[var(--ozer-cool-blue)]',
    coral: 'text-[var(--ozer-accent)]',
    sage: 'text-[var(--ozer-sage-500)]',
    lime: 'text-[var(--ozer-plum-700)]',
    plum: 'text-[var(--ozer-plum-600)]',
  };

export const EARLY_ACCESS_ACCENT_SOFT_CLASS: Record<EarlyAccessAccent, string> =
  {
    'cool-blue':
      'bg-[color-mix(in_srgb,var(--ozer-cool-blue)_12%,var(--ozer-cream-50))] text-[var(--ozer-cool-blue)]',
    coral: 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-600)]',
    sage: 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-700)]',
    lime: 'bg-[var(--ozer-lime-100)] text-[var(--ozer-plum-700)]',
    plum: 'bg-[var(--ozer-plum-alpha-08)] text-[var(--ozer-plum-600)]',
  };

export const EARLY_ACCESS_PILL_CHAIN = [
  { label: 'CRM', accent: 'cool-blue' as const },
  { label: 'Invoices', accent: 'coral' as const },
  { label: 'Portals', accent: 'sage' as const },
  { label: 'Notes', accent: 'lime' as const },
  { label: 'Tasks', accent: 'plum' as const },
];

export const EARLY_ACCESS_BENTO_FEATURES: Array<{
  title: string;
  desc: string;
  status: EarlyAccessFeatureStatus;
  accent: EarlyAccessAccent;
  wide?: boolean;
}> = [
  {
    title: 'Pipeline & CRM',
    desc: 'Every client and deal, tracked from first enquiry to signed work.',
    status: 'live',
    accent: 'cool-blue',
    wide: true,
  },
  {
    title: 'Invoicing',
    desc: "Send invoices and track what's outstanding.",
    status: 'live',
    accent: 'coral',
  },
  {
    title: 'Client portals',
    desc: 'A proper home for files, updates and approvals.',
    status: 'live',
    accent: 'sage',
  },
  {
    title: 'Second brain',
    desc: 'Every note, meeting and client detail — remembered and searchable.',
    status: 'live',
    accent: 'lime',
  },
  {
    title: 'Client requests',
    desc: 'A menu of services clients can request, paid for with credits — not endless email back-and-forth.',
    status: 'live',
    accent: 'plum',
  },
  {
    title: 'Scheduling',
    desc: 'Bookings and availability, without the back-and-forth.',
    status: 'live',
    accent: 'cool-blue',
  },
  {
    title: 'Tasks',
    desc: 'One list, not five apps and a notebook.',
    status: 'live',
    accent: 'coral',
  },
  {
    title: 'Messaging',
    desc: 'Talk to clients without leaving the project.',
    status: 'live',
    accent: 'sage',
  },
  {
    title: 'Email assistant',
    desc: 'Triages your inbox, drafts replies, and turns messages into tasks automatically.',
    status: 'soon',
    accent: 'plum',
    wide: true,
  },
  {
    title: 'Meeting assistant',
    desc: 'Records, transcribes and coaches your calls — then turns them into follow-up tasks.',
    status: 'soon',
    accent: 'sage',
  },
  {
    title: 'Planner',
    desc: 'Turns your tasks, meetings and deadlines into an actual plan for your day.',
    status: 'soon',
    accent: 'coral',
    wide: true,
  },
  {
    title: 'Site Studio',
    desc: 'Build and publish client sites visually.',
    status: 'soon',
    accent: 'lime',
  },
  {
    title: 'AI media generation',
    desc: 'On-brand images and video for client work.',
    status: 'addon',
    accent: 'cool-blue',
  },
  {
    title: 'Screen recording',
    desc: 'Record your screen for tutorials, walkthroughs and client feedback.',
    status: 'addon',
    accent: 'plum',
  },
];

export const EARLY_ACCESS_STATUS_LABEL: Record<
  EarlyAccessFeatureStatus,
  string | null
> = {
  live: null,
  soon: 'Coming soon',
  addon: 'Add-on',
};

export const EARLY_ACCESS_FEATURE_BLOCKS: Array<{
  accent: EarlyAccessAccent;
  eyebrow: string;
  title: string;
  desc: string;
  mock:
    | 'kanban'
    | 'invoice'
    | 'portal'
    | 'notes'
    | 'email'
    | 'requests'
    | 'planner';
  reverse?: boolean;
  soon?: boolean;
}> = [
  {
    accent: 'cool-blue',
    eyebrow: 'Pipeline & CRM',
    title: 'See every client and every deal, in one view.',
    desc: 'Track enquiries through to signed work without losing anything in your inbox. One board, one source of truth.',
    mock: 'kanban',
  },
  {
    accent: 'coral',
    eyebrow: 'Invoicing',
    title: 'Get paid without the admin.',
    desc: "Send professional invoices, track what's outstanding, and stop copying numbers between spreadsheets.",
    mock: 'invoice',
    reverse: true,
  },
  {
    accent: 'sage',
    eyebrow: 'Client portals',
    title: 'Give clients a proper home, not a shared folder.',
    desc: 'Share files, updates and approvals somewhere that looks like part of your business — not a random Dropbox link.',
    mock: 'portal',
  },
  {
    accent: 'lime',
    eyebrow: 'Second brain',
    title: "Keep client context where you'll actually find it.",
    desc: 'Meeting notes, project details and decisions, attached to the client they belong to — and searchable the moment you need them.',
    mock: 'notes',
    reverse: true,
  },
  {
    accent: 'plum',
    eyebrow: 'Email assistant',
    title: 'Your inbox, triaged for you.',
    desc: 'Reads your inbox, drafts replies in your voice, and turns anything that needs doing into a task — automatically.',
    mock: 'email',
    soon: true,
  },
  {
    accent: 'plum',
    eyebrow: 'Client requests',
    title: 'Let clients ask, without the endless email thread.',
    desc: 'Publish a menu of services you offer, each with a credit cost. Clients request what they need, you approve it, and it lands straight in your queue.',
    mock: 'requests',
  },
  {
    accent: 'coral',
    eyebrow: 'Planner',
    title: 'A plan for your day, not just a list for it.',
    desc: "Pulls your tasks, meetings and deadlines together into an actual schedule — so you know what to do next, not just what's outstanding.",
    mock: 'planner',
    reverse: true,
    soon: true,
  },
];

export const EARLY_ACCESS_PERSONAS: Array<{
  accent: EarlyAccessAccent;
  title: string;
  desc: string;
  wide?: boolean;
}> = [
  {
    accent: 'cool-blue',
    title: 'Solo designer or developer',
    desc: 'Replace a CRM, an invoicing tool and a notes app with one login.',
  },
  {
    accent: 'coral',
    title: 'Consultant or coach',
    desc: "Keep every client's history and next step somewhere you'll actually check.",
  },
  {
    accent: 'sage',
    title: 'Small studio, 2–5 people',
    desc: 'Give your team one shared view of clients, without more software to manage.',
  },
  {
    accent: 'lime',
    title: 'Freelance writer or marketer',
    desc: 'Turn scattered briefs and feedback threads into a proper pipeline.',
  },
  {
    accent: 'plum',
    title: 'Virtual assistant',
    desc: 'Turn client requests and retainer hours into one simple system, not an inbox of one-off asks.',
    wide: true,
  },
];

export const EARLY_ACCESS_FAQS = [
  {
    question: "What's actually included right now?",
    answer:
      "Pipeline & CRM, invoicing, client portals, tasks, scheduling and notes — all fully tested and live from day one. We don't put anything in front of early adopters that isn't solid.",
  },
  {
    question: 'What about the email assistant and planner?',
    answer:
      "Both are already in testing. As a tester you get them the moment they're ready, automatically — no separate signup, and no change to what you're paying.",
  },
  {
    question: 'What does early access cost?',
    answer:
      "£14/month for your first 3 months — everything on this page, with extra seats at £9/month each. When that period ends, you pick whatever fits how you work, or stay on full access and keep 15% off for as long as you're with us.",
  },
  {
    question: 'Is my client data safe?',
    answer:
      'Yes. Ozer is built privacy-first and hosted in the UK/EU. We never sell or share your data, and we mean that literally, not as a footer line.',
  },
  {
    question: 'When do I actually get in?',
    answer:
      "This pricing is for people who join in September, so everyone's testing on the same timeline. We onboard by hand in small batches, so it might take a little while — you'll hear from a real person, not an automated welcome email. Sign up after September and we'll add you to the next cohort.",
  },
] as const;
