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
    desc: 'Every client and deal in one place — so nothing lives only in your inbox.',
    status: 'live',
    accent: 'cool-blue',
    wide: true,
  },
  {
    title: 'Invoicing',
    desc: 'Send an invoice and see what is still owed — without opening a spreadsheet.',
    status: 'live',
    accent: 'coral',
  },
  {
    title: 'Client portals',
    desc: 'One link for files and sign-off — not another folder to babysit.',
    status: 'live',
    accent: 'sage',
  },
  {
    title: 'Second brain',
    desc: 'Walk into a call with context already there — not a scramble through notes.',
    status: 'live',
    accent: 'lime',
  },
  {
    title: 'Client requests',
    desc: 'Clear asks with credit costs — not vague favours buried in email.',
    status: 'live',
    accent: 'plum',
  },
  {
    title: 'Scheduling',
    desc: 'Bookings without the back-and-forth — clients pick a time that works.',
    status: 'live',
    accent: 'cool-blue',
  },
  {
    title: 'Tasks',
    desc: 'One list for what is actually due — not five apps and a notebook.',
    status: 'live',
    accent: 'coral',
  },
  {
    title: 'Messaging',
    desc: 'Client chat tied to the project — not another thread to lose.',
    status: 'live',
    accent: 'sage',
  },
  {
    title: 'Email assistant',
    desc: 'Open your inbox already sorted — replies drafted, tasks extracted.',
    status: 'soon',
    accent: 'plum',
    wide: true,
  },
  {
    title: 'Meeting assistant',
    desc: 'Leave the call with notes and follow-ups — not a mental to-do list.',
    status: 'soon',
    accent: 'sage',
  },
  {
    title: 'Planner',
    desc: 'See your day as a plan — calls, deep work, and what to do next.',
    status: 'soon',
    accent: 'coral',
    wide: true,
  },
  {
    title: 'Site Studio',
    desc: 'Ship client sites from the same workspace you run the project in.',
    status: 'soon',
    accent: 'lime',
  },
  {
    title: 'AI media generation',
    desc: 'On-brand visuals when the brief lands — not a separate creative stack.',
    status: 'addon',
    accent: 'cool-blue',
  },
  {
    title: 'Screen recording',
    desc: 'Record a walkthrough in a click — feedback that clients actually watch.',
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
  id: string;
  accent: EarlyAccessAccent;
  icon: string;
  eyebrow: string;
  title: string;
  moment: string;
  desc: string;
  highlights: string[];
  mock:
    | 'kanban'
    | 'invoice'
    | 'portal'
    | 'notes'
    | 'email'
    | 'requests'
    | 'planner';
  soon?: boolean;
}> = [
  {
    id: 'pipeline-crm',
    accent: 'cool-blue',
    icon: 'Kanban',
    eyebrow: 'Pipeline & CRM',
    title: 'You always know what happens next with a client.',
    moment:
      'A new enquiry lands while you are in a meeting — you open Ozer later and it is already on the board, with the next step obvious.',
    desc: 'Track enquiries through to signed work without digging through email. One board, one source of truth.',
    highlights: [
      'Kanban board from first enquiry to invoiced',
      'Client records linked to every deal and note',
      'See where each prospect stands at a glance',
      'Nothing slips through because it lived in email',
    ],
    mock: 'kanban',
  },
  {
    id: 'email-assistant',
    accent: 'plum',
    icon: 'Sparkles',
    eyebrow: 'Email assistant',
    title: 'Start the day knowing what actually needs you.',
    moment:
      'You open your inbox and the noise is already sorted — what needs a reply, what is waiting on someone else, and what can wait.',
    desc: 'Drafts replies in your voice and turns action into tasks, so you are responding — not reorganising.',
    highlights: [
      'Triages your inbox by what needs a reply',
      'Drafts responses in your voice',
      'Turns action items into tasks automatically',
      'Flags threads you should not let slip',
    ],
    mock: 'email',
    soon: true,
  },
  {
    id: 'planner',
    accent: 'coral',
    icon: 'CalendarDays',
    eyebrow: 'Planner',
    title: 'Your day has a shape, not just a pile of tasks.',
    moment:
      'It is 9:15 and you can see the call, the deep work block, and when to chase that invoice — without rebuilding the plan in your head.',
    desc: 'Pulls tasks, meetings and deadlines into a schedule you can actually follow.',
    highlights: [
      'Builds a schedule from tasks and meetings',
      'Shows what to do next, not just what is open',
      'Balances deep work and client calls',
      'Updates as deadlines and priorities shift',
    ],
    mock: 'planner',
    soon: true,
  },
  {
    id: 'invoicing',
    accent: 'coral',
    icon: 'FileText',
    eyebrow: 'Invoicing',
    title: 'Getting paid should not need a spreadsheet ritual.',
    moment:
      'You send an invoice after a call and immediately see what is still outstanding — no copying numbers into another tab.',
    desc: 'Professional invoices, payment status, and totals in one place tied to the client.',
    highlights: [
      'Send invoices in a few clicks',
      'Track paid, sent and overdue at a glance',
      'Outstanding totals without a spreadsheet',
      'Invoices tied to the client and project they belong to',
    ],
    mock: 'invoice',
  },
  {
    id: 'client-portals',
    accent: 'sage',
    icon: 'LayoutDashboard',
    eyebrow: 'Client portals',
    title: 'Clients feel looked after, not lost in a folder.',
    moment:
      'They open one link, find the latest files, and sign off — no "which Dropbox was that?" message.',
    desc: 'A branded space for files, updates and approvals tied to the project.',
    highlights: [
      'Share files and updates in one branded space',
      'Clients approve work without email chains',
      'Everything tied to the right project',
      'A client-facing home that looks like your business',
    ],
    mock: 'portal',
  },
  {
    id: 'second-brain',
    accent: 'lime',
    icon: 'Brain',
    eyebrow: 'Second brain',
    title: 'Context is there when the client calls.',
    moment:
      'Five minutes before a catch-up, you pull up the record and the last decision is right where you left it.',
    desc: 'Notes and meeting detail on the client they belong to — searchable when you need them.',
    highlights: [
      'Notes attached to the client they belong to',
      'Meeting summaries searchable when you need them',
      'Tags and context that survives the week',
      'Decisions and details in one place, not five apps',
    ],
    mock: 'notes',
  },
  {
    id: 'client-requests',
    accent: 'plum',
    icon: 'ClipboardList',
    eyebrow: 'Client requests',
    title: 'Scope stays clear without another email thread.',
    moment:
      'A client picks from your menu, you approve in a click, and it lands in your queue — not as a vague "quick favour".',
    desc: 'Services with credit costs, so requests are explicit and billable.',
    highlights: [
      'Publish a menu of services with credit costs',
      'Clients request work without back-and-forth email',
      'Approve or decline in one click',
      'Approved requests land straight in your queue',
    ],
    mock: 'requests',
  },
];

export const EARLY_ACCESS_PERSONAS: Array<{
  accent: EarlyAccessAccent;
  title: string;
  desc: string;
  features: string[];
}> = [
  {
    accent: 'cool-blue',
    title: 'Solo designer or developer',
    desc: 'Friday afternoon and you are not hunting for "where that lead went".',
    features: [
      'Pipeline & CRM',
      'Invoicing',
      'Client portals',
      'Tasks',
      'Scheduling',
    ],
  },
  {
    accent: 'coral',
    title: 'Consultant or coach',
    desc: 'You walk into every session knowing what you agreed last time.',
    features: [
      'Pipeline & CRM',
      'Second brain',
      'Scheduling',
      'Messaging',
      'Planner',
    ],
  },
  {
    accent: 'sage',
    title: 'Small studio, 2–5 people',
    desc: 'The whole team sees the same client picture — no status meeting required.',
    features: [
      'Pipeline & CRM',
      'Tasks',
      'Messaging',
      'Invoicing',
      'Client portals',
    ],
  },
  {
    accent: 'lime',
    title: 'Freelance writer or marketer',
    desc: 'Briefs and feedback live on the deal — not buried in threads.',
    features: [
      'Pipeline & CRM',
      'Client portals',
      'Second brain',
      'Messaging',
      'Client requests',
    ],
  },
  {
    accent: 'plum',
    title: 'Virtual assistant',
    desc: 'Retainer work and one-off asks land in one queue — clearly scoped.',
    features: [
      'Client requests',
      'Tasks',
      'Scheduling',
      'Invoicing',
      'Messaging',
    ],
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
