import type { Metadata } from 'next';

import type {
  ConnectedFeature,
  FAQItem,
  FeatureHighlight,
} from '~/(marketing)/_components/FeatureLandingPage';

export type FeatureSlug =
  | 'planner'
  | 'email-assistant'
  | 'desktop-assistant'
  | 'dictation'
  | 'pipeline'
  | 'project-management'
  | 'tasks'
  | 'contracts'
  | 'sops'
  | 'client-portals'
  | 'invoicing'
  | 'finances'
  | 'second-brain'
  | 'messaging'
  | 'notes';

export type FeaturePageConfig = {
  slug: FeatureSlug;
  name: string;
  shortDescription: string;
  indexIcon: string;
  primaryKeyword: string;
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    canonical: string;
    openGraphTitle: string;
  };
  jsonLd: Record<string, unknown>;
  props: {
    eyebrow: string;
    heading: string;
    subheading: string;
    highlights: FeatureHighlight[];
    connectedTo: ConnectedFeature[];
    connectionHeading: string;
    connectionDescription: string;
    faqs: FAQItem[];
  };
  heroBadge?: string;
  secondaryCta?: {
    label: string;
    href: string;
  };
};

export const FEATURE_INDEX_ORDER: FeatureSlug[] = [
  'planner',
  'email-assistant',
  'desktop-assistant',
  'dictation',
  'pipeline',
  'project-management',
  'tasks',
  'contracts',
  'sops',
  'client-portals',
  'invoicing',
  'finances',
  'messaging',
  'notes',
  'second-brain',
];

export const FEATURE_SITEMAP_PATHS = [
  '/features',
  ...FEATURE_INDEX_ORDER.map((slug) => `/features/${slug}`),
] as const;

export const FEATURE_NAV_GROUPS = [
  {
    label: 'Work',
    items: [
      { label: 'Pipeline', href: '/features/pipeline' },
      { label: 'Project Management', href: '/features/project-management' },
      { label: 'Tasks', href: '/features/tasks' },
      { label: 'Planner', href: '/features/planner' },
      { label: 'Contracts', href: '/features/contracts' },
      { label: 'SOPs', href: '/features/sops' },
    ],
  },
  {
    label: 'Clients',
    items: [
      { label: 'Client Portals', href: '/features/client-portals' },
      { label: 'Messaging', href: '/features/messaging' },
      { label: 'Invoicing', href: '/features/invoicing' },
    ],
  },
  {
    label: 'Finance',
    items: [{ label: 'Finances', href: '/features/finances' }],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Email Assistant', href: '/features/email-assistant' },
      { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
      { label: 'Dictation', href: '/features/dictation' },
      { label: 'Second Brain', href: '/features/second-brain' },
      { label: 'Notes', href: '/features/notes' },
    ],
  },
] as const;

const FEATURE_PAGES: Record<FeatureSlug, FeaturePageConfig> = {
  planner: {
    slug: 'planner',
    name: 'Planner',
    shortDescription:
      'A daily plan pulled from your real projects, deadlines, and calendar.',
    indexIcon: 'CalendarDays',
    primaryKeyword: 'daily planner for freelancers',
    metadata: {
      title: 'Daily Planner for Freelancers | Ozer',
      description:
        "Ozer's daily planner shows you exactly what to work on today — pulled from your real projects and client deadlines, not a separate to-do list.",
      keywords: [
        'daily planner for freelancers',
        'task planner for agencies',
        'daily focus planner',
        'freelance task manager',
      ],
      canonical: 'https://ozer.so/features/planner',
      openGraphTitle: 'Daily Planner for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Daily Planner for Freelancers',
      description:
        "Ozer's daily planner shows you exactly what to work on today — pulled from your real projects and client deadlines.",
      url: 'https://ozer.so/features/planner',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Planner',
      heading: 'The Daily Planner Built for How Freelancers Actually Work',
      subheading:
        'Not just a task list. A focused view of what to work on today — pulled directly from your active projects, client deadlines, and calendar.',
      highlights: [
        {
          icon: 'Sun',
          title: "Today's focus, always clear",
          description:
            'One view of everything that needs attention today. Pulled from your active projects automatically — no manual re-entry, no separate to-do app.',
        },
        {
          icon: 'FolderKanban',
          title: 'Tasks from real projects',
          description:
            'Everything in your daily plan comes from actual client work. When you complete a task, it updates the project. Nothing gets out of sync.',
        },
        {
          icon: 'CalendarDays',
          title: 'Calendar-aware planning',
          description:
            "Your meetings block time automatically. Ozer plans your workable hours around what's already in your calendar — not on top of it.",
        },
        {
          icon: 'AlertCircle',
          title: 'Nothing falls through',
          description:
            "Overdue tasks surface automatically. Deadlines that are slipping get flagged. The plan adapts so you don't have to chase what you missed.",
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Calendar', href: '/features/desktop-assistant' },
        { label: 'Pipeline', href: '/features/pipeline' },
        { label: 'Notes', href: '/features/notes' },
      ],
      connectionHeading: 'Planned around your actual work',
      connectionDescription:
        "The planner isn't a standalone to-do list — it reads your projects, deadlines, and calendar and tells you what today should look like.",
      faqs: [
        {
          question: 'How is this different from a regular task manager?',
          answer:
            "Most task managers are a separate system you have to keep in sync with your actual work. Ozer's planner reads directly from your projects and client records, so your daily plan reflects what's actually happening — not a copy of it.",
        },
        {
          question: 'Can I add personal tasks as well as client work?',
          answer:
            'Yes. You can add any task to your daily plan, whether it\'s client-facing or internal. Everything lives in one view.',
        },
        {
          question: 'Does it work with my calendar?',
          answer:
            'Yes. Ozer reads your calendar so meetings block time automatically. Your plannable hours are what\'s left.',
        },
      ],
    },
  },
  'email-assistant': {
    slug: 'email-assistant',
    name: 'Email Assistant',
    shortDescription:
      'AI inbox connected to your clients, projects, and action items.',
    indexIcon: 'Sparkles',
    primaryKeyword: 'AI email assistant for freelancers',
    metadata: {
      title: 'AI Email Assistant for Freelancers | Ozer',
      description:
        "Ozer's email assistant connects your inbox to your clients and projects. AI that drafts replies, extracts action items, and gives every email the context it needs.",
      keywords: [
        'AI email assistant for freelancers',
        'email management for agencies',
        'client email tool',
        'AI inbox for freelancers',
      ],
      canonical: 'https://ozer.so/features/email-assistant',
      openGraphTitle: 'AI Email Assistant for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'AI Email Assistant for Freelancers',
      description:
        "Ozer's email assistant connects your inbox to your clients and projects. AI that drafts replies, extracts action items, and gives every email the context it needs.",
      url: 'https://ozer.so/features/email-assistant',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Email Assistant',
      heading: "The Email Assistant That Knows Who You're Talking To",
      subheading:
        'Every email connected to the right client and project. AI that drafts, summarises, and extracts action items — with context that actually matters.',
      highlights: [
        {
          icon: 'Users',
          title: 'Client-aware inbox',
          description:
            'Every thread is tagged to the right client automatically. Open an email and the project, conversation history, and outstanding tasks are already there alongside it.',
        },
        {
          icon: 'Sparkles',
          title: 'AI drafts with context',
          description:
            "Reply drafts are generated knowing who the client is, what project you're on, and what's been agreed. Less rewriting. More sending.",
        },
        {
          icon: 'CheckSquare',
          title: 'Action items extracted',
          description:
            'When a client asks you to do something, Ozer captures it as a task automatically. Nothing gets buried three screens down in a long thread.',
        },
        {
          icon: 'Clock',
          title: 'Full thread history in one place',
          description:
            'Every email conversation with a client lives alongside their project, portal, and invoices. No more switching between apps to find what was said.',
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Clients', href: '/features/pipeline' },
        { label: 'Planner', href: '/features/planner' },
        { label: 'Client Portals', href: '/features/client-portals' },
        { label: 'Second Brain', href: '/features/second-brain' },
      ],
      connectionHeading: "Email that's part of your workflow",
      connectionDescription:
        'When an email comes in, Ozer already knows the client, the project, and what\'s outstanding — so you can act on it, not just read it.',
      faqs: [
        {
          question: 'Does this work with Gmail?',
          answer:
            'Yes. Ozer connects to your Gmail account and syncs your inbox. Your emails stay in Gmail — Ozer adds the project context and AI layer on top.',
        },
        {
          question: 'Can I still use Gmail normally?',
          answer:
            "Completely. Ozer doesn't replace Gmail — it connects to it. You can continue using Gmail as normal and access the Ozer layer when you need context or drafting help.",
        },
        {
          question: 'Is my email data private?',
          answer:
            "Yes. Your email data is never used to train AI models. It's processed to provide you with context, drafts, and action items — and stays within your account.",
        },
      ],
    },
  },
  'desktop-assistant': {
    slug: 'desktop-assistant',
    name: 'Desktop Assistant',
    shortDescription:
      'Native Mac app for meeting notes, transcription, tasks, and follow-up automation.',
    indexIcon: 'Mic',
    primaryKeyword: 'meeting notes desktop app Mac',
    heroBadge: 'Native macOS desktop app · Download for Mac',
    secondaryCta: {
      label: 'Download for Mac',
      href: '#early-access',
    },
    metadata: {
      title: 'Meeting Notes Desktop App for Mac | Ozer Assistant',
      description:
        'Download Ozer Assistant for Mac — records any call or in-person meeting, separates speakers, extracts tasks, drafts follow-up emails, and logs everything to your second brain.',
      keywords: [
        'meeting notes desktop app Mac',
        'AI meeting recorder Mac',
        'in-person meeting transcription',
        'Mac meeting notes download',
        'automatic meeting notes',
      ],
      canonical: 'https://ozer.so/features/desktop-assistant',
      openGraphTitle: 'Meeting Notes Desktop App for Mac | Ozer Assistant',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Ozer Assistant',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'macOS',
      description:
        'Native macOS desktop app that records any call or in-person meeting, separates speakers, transcribes with AI, extracts tasks, and syncs everything to Ozer.',
      url: 'https://ozer.so/features/desktop-assistant',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Assistant for Mac',
      heading:
        'Download the Mac App That Turns Meetings Into Tasks and Follow-Ups',
      subheading:
        'Ozer Assistant is a native macOS desktop download. It records any call or in-room meeting, separates speakers automatically, then turns the conversation into tasks, follow-up emails, and searchable knowledge — without you lifting a finger.',
      highlights: [
        {
          icon: 'Mic',
          title: 'Any call. Any room.',
          description:
            'Works across Zoom, Google Meet, Teams, or any app on your Mac. For in-person meetings, it separates speakers from a single microphone — so you know who said what, even in the room.',
        },
        {
          icon: 'CheckSquare',
          title: 'Tasks extracted to your list',
          description:
            'Action items land in your Ozer task list automatically — linked to the right client and project. Review, edit, or add them to your daily plan without retyping from notes.',
        },
        {
          icon: 'CalendarDays',
          title: 'Calendar-connected',
          description:
            'Meeting reminders arrive before calls start. Client name, project, and context are autofilled from your calendar before you hit record.',
        },
        {
          icon: 'Zap',
          title: 'Emails and second brain',
          description:
            'When the call ends, a follow-up email is drafted and the full transcript is indexed in your second brain — searchable forever.',
        },
      ],
      connectedTo: [
        { label: 'Tasks', href: '/features/tasks' },
        { label: 'Calendar', href: '/features/planner' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Second Brain', href: '/features/second-brain' },
        { label: 'Dictation', href: '/features/dictation' },
      ],
      connectionHeading: 'Not a standalone app — the meeting layer of Ozer',
      connectionDescription:
        'Ozer Assistant feeds directly into your tasks, projects, inbox, and knowledge base. Every meeting becomes part of your workflow, not a break from it.',
      faqs: [
        {
          question: 'How do I download Ozer Assistant for Mac?',
          answer:
            'Join early access to get the macOS download link. After installing, sign in with your Ozer account from the app to sync meetings and tasks to your workspaces.',
        },
        {
          question: 'Does it work with any call tool?',
          answer:
            'Yes. It captures system audio directly from your Mac, so it works with any call tool — Zoom, Google Meet, Microsoft Teams, FaceTime, or anything else. No bot joins the call.',
        },
        {
          question: 'How does in-person speaker separation work?',
          answer:
            "Using your Mac's microphone, Ozer Assistant identifies distinct voices in the room and labels them separately in the transcript. You can tell who said what without needing multiple recording devices.",
        },
        {
          question: 'Is audio stored anywhere?',
          answer:
            'No audio is ever written to disk. The audio is processed in real time for transcription and then discarded. Only the transcript and extracted data are stored in Ozer.',
        },
        {
          question: 'Is this a Mac-only app?',
          answer:
            'Currently yes — Ozer Assistant is a native macOS desktop download. Windows support is on the roadmap.',
        },
      ],
    },
  },
  dictation: {
    slug: 'dictation',
    name: 'Dictation',
    shortDescription:
      'Speak anywhere on your Mac — polished text with punctuation, instantly.',
    indexIcon: 'Keyboard',
    primaryKeyword: 'voice dictation Mac app',
    heroBadge: 'Part of Ozer Assistant for Mac',
    secondaryCta: {
      label: 'Download for Mac',
      href: '#early-access',
    },
    metadata: {
      title: 'Voice Dictation for Mac | Ozer Assistant',
      description:
        'Press fn anywhere on your Mac and dictate into any app. Ozer Assistant turns speech into clean, punctuated text — with grammar that reads like you wrote it.',
      keywords: [
        'voice dictation Mac app',
        'Mac dictation software',
        'speech to text Mac',
        'dictation hotkey Mac',
        'AI dictation punctuation',
      ],
      canonical: 'https://ozer.so/features/dictation',
      openGraphTitle: 'Voice Dictation for Mac | Ozer Assistant',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Ozer Assistant Dictation',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'macOS',
      description:
        'Global dictation hotkey for macOS — speak into any text field with automatic punctuation and grammar.',
      url: 'https://ozer.so/features/dictation',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Dictation',
      heading: 'Dictate Into Any App on Your Mac — With Text That Actually Reads Well',
      subheading:
        'Part of the Ozer Assistant macOS download. Press fn, speak naturally, and get polished text in whatever field you are focused on — email, notes, proposals, or Slack.',
      highlights: [
        {
          icon: 'Keyboard',
          title: 'Global fn hotkey',
          description:
            'Works in any app on your Mac. Focus a text field, press fn, and speak. Your words appear where your cursor is — no switching tools or copy-pasting from a separate dictation window.',
        },
        {
          icon: 'Sparkles',
          title: 'Punctuation and grammar built in',
          description:
            'Not raw speech-to-text. Ozer cleans up punctuation, capitalisation, and sentence structure so the output reads like you typed it carefully.',
        },
        {
          icon: 'Clipboard',
          title: 'Paste or copy',
          description:
            'Dictation can type directly into the focused field, or copy to your clipboard so you paste where you need it.',
        },
        {
          icon: 'History',
          title: 'History in Ozer',
          description:
            'Recent dictation snippets sync to your Ozer account so you can find and reuse phrasing from earlier in the day.',
        },
      ],
      connectedTo: [
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Notes', href: '/features/notes' },
        { label: 'Second Brain', href: '/features/second-brain' },
      ],
      connectionHeading: 'Shipped with Ozer Assistant for Mac',
      connectionDescription:
        'Dictation is included in the same macOS desktop download as meeting recording — one app for capture, tasks, and typing at the speed of speech.',
      faqs: [
        {
          question: 'Is dictation a separate download?',
          answer:
            'No. Dictation is built into Ozer Assistant for Mac — the same native desktop app you use for meeting notes and transcription.',
        },
        {
          question: 'Does it work outside Ozer?',
          answer:
            'Yes. The global hotkey works in any macOS app with a text field — Mail, Notion, Google Docs, Slack, and more.',
        },
        {
          question: 'Can I see past dictation snippets?',
          answer:
            'Yes. Recent dictation history syncs to your Ozer personal settings so you can copy or reference earlier snippets.',
        },
      ],
    },
  },
  'client-portals': {
    slug: 'client-portals',
    name: 'Client Portals',
    shortDescription:
      'Branded client spaces that stay in sync with your projects.',
    indexIcon: 'LayoutDashboard',
    primaryKeyword: 'client portal software for agencies',
    metadata: {
      title: 'Client Portal Software for Agencies | Ozer',
      description:
        "Give every client a professional portal — without logging into a separate tool. Ozer's client portals live inside your workflow and stay in sync with your projects automatically.",
      keywords: [
        'client portal software for agencies',
        'freelance client portal',
        'client portal tool',
        'agency client portal',
      ],
      canonical: 'https://ozer.so/features/client-portals',
      openGraphTitle: 'Client Portal Software for Agencies | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Client Portal Software for Agencies',
      description:
        "Give every client a professional portal — without logging into a separate tool. Ozer's client portals live inside your workflow and stay in sync with your projects automatically.",
      url: 'https://ozer.so/features/client-portals',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Client Portals',
      heading: 'Client Portals That Live Inside Your Workflow — Not Outside It',
      subheading:
        'A professional, branded space for every client. No separate login, no manual updating, no tool that lives in a different universe from the rest of your work.',
      highlights: [
        {
          icon: 'LayoutDashboard',
          title: 'One portal per client',
          description:
            'Every client relationship gets its own clean, professional space. Share files, updates, and deliverables without sending another email attachment.',
        },
        {
          icon: 'RefreshCw',
          title: 'In sync with your projects',
          description:
            "What's in the portal reflects what's in your project — automatically. No duplication, no remembering to update two places.",
        },
        {
          icon: 'CheckCircle',
          title: 'Approvals and feedback',
          description:
            'Clients can review deliverables, leave feedback, and sign off — all inside the portal. No email chains, no version confusion.',
        },
        {
          icon: 'Plug',
          title: 'Built in, not bolted on',
          description:
            "Manage the portal from the same place you manage the project, the invoice, and the email. Because they're all the same thing.",
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Messaging', href: '/features/messaging' },
        { label: 'Files', href: '/features/notes' },
      ],
      connectionHeading: "The client's view of your entire relationship",
      connectionDescription:
        "The portal isn't just a file share. It's the joined-up view of everything you've done for a client — visible to them, managed by you.",
      faqs: [
        {
          question: 'Do clients need to create an account?',
          answer:
            "Clients access their portal via a secure link. You control what they can see and do — they don't need to learn a new tool.",
        },
        {
          question: "Can I brand the portal with my agency's identity?",
          answer:
            "Yes. Portals reflect your agency's branding, not Ozer's. Your clients see a professional experience that feels like yours.",
        },
        {
          question: 'Can I use the portal for file sharing?',
          answer:
            'Yes. Share deliverables, documents, and assets directly in the portal. Clients can download, review, and comment.',
        },
      ],
    },
  },
  invoicing: {
    slug: 'invoicing',
    name: 'Invoicing',
    shortDescription:
      'Send invoices from your projects with client details already filled in.',
    indexIcon: 'FileText',
    primaryKeyword: 'invoicing software for freelancers',
    metadata: {
      title: 'Invoicing Software for Freelancers | Ozer',
      description:
        "Send invoices directly from your project — not from a separate app. Ozer's invoicing knows the client, the work, and what was agreed, because it's connected to everything else.",
      keywords: [
        'invoicing software for freelancers',
        'freelance invoice tool',
        'agency invoicing software',
        'invoice management freelancers',
      ],
      canonical: 'https://ozer.so/features/invoicing',
      openGraphTitle: 'Invoicing Software for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Invoicing Software for Freelancers',
      description:
        "Send invoices directly from your project — not from a separate app. Ozer's invoicing knows the client, the work, and what was agreed, because it's connected to everything else.",
      url: 'https://ozer.so/features/invoicing',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Invoicing',
      heading: 'Send Invoices From Inside Your Project. Not From a Different App.',
      subheading:
        "Invoicing that knows which project it's for, who the client is, and what was agreed — because it's connected to your actual work, not sitting in a separate system.",
      highlights: [
        {
          icon: 'FileText',
          title: 'One click from project to invoice',
          description:
            'Raise an invoice directly from the project it belongs to. The client details, project name, and deliverables are already there.',
        },
        {
          icon: 'UserCheck',
          title: 'No re-entering client details',
          description:
            'Client information lives in Ozer once. Every invoice, portal, and email pulls from the same record — no copy-pasting the same address into a different tool again.',
        },
        {
          icon: 'TrendingUp',
          title: "See what's paid and what's outstanding",
          description:
            'Outstanding invoices surface against the projects they belong to. Know who owes you what without opening a separate spreadsheet.',
        },
        {
          icon: 'Palette',
          title: 'Professional, branded invoices',
          description:
            "Clean invoice templates that reflect the quality of your work. Send something you're proud to put your name on.",
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Clients', href: '/features/pipeline' },
        { label: 'Finances', href: '/features/finances' },
        { label: 'Client Portals', href: '/features/client-portals' },
      ],
      connectionHeading:
        "Invoicing that's part of the project, not separate from it",
      connectionDescription:
        'When a project wraps up, the invoice is one step — not a context switch to a different tool with a blank form.',
      faqs: [
        {
          question: 'Can I send recurring invoices?',
          answer:
            'Yes. Set up recurring billing for retainer clients and Ozer handles the scheduling automatically.',
        },
        {
          question: 'What payment methods can clients use?',
          answer:
            'Ozer integrates with Stripe, so clients can pay by card directly from the invoice. Bank transfer details can also be included.',
        },
        {
          question: 'Does invoicing connect to my finances overview?',
          answer:
            'Yes. Every invoice flows directly into your Ozer Finances dashboard — so your revenue, outstanding amounts, and project profitability are always up to date.',
        },
      ],
    },
  },
  'second-brain': {
    slug: 'second-brain',
    name: 'Second Brain',
    shortDescription:
      'Searchable knowledge built automatically from your work.',
    indexIcon: 'Brain',
    primaryKeyword: 'second brain for freelancers',
    metadata: {
      title: 'Second Brain for Freelancers | Ozer',
      description:
        "Ozer's second brain automatically indexes every meeting, email, note, and project. Search anything in plain English and get answers with citations back to the source.",
      keywords: [
        'second brain for freelancers',
        'AI knowledge base for agencies',
        'business second brain',
        'searchable meeting notes',
        'freelance knowledge management',
      ],
      canonical: 'https://ozer.so/features/second-brain',
      openGraphTitle: 'Second Brain for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Second Brain for Freelancers',
      description:
        "Ozer's second brain automatically indexes every meeting, email, note, and project. Search anything in plain English and get answers with citations back to the source.",
      url: 'https://ozer.so/features/second-brain',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Second Brain',
      heading: 'A Second Brain That Builds Itself From Your Work',
      subheading:
        'Every meeting, email, note, and project automatically indexed and searchable. Ask it anything. Get answers — with citations back to exactly where the information came from.',
      highlights: [
        {
          icon: 'Brain',
          title: 'Automatically built',
          description:
            'No manual tagging, importing, or organising. Everything you do in Ozer is indexed as you work — meetings, emails, notes, project decisions. It builds itself.',
        },
        {
          icon: 'Search',
          title: 'Ask in plain English',
          description:
            'Search by topic, client name, decision, or timeframe. Ask "what did we agree on the Thistleleaf rebrand?" and get the answer — not a list of files to dig through.',
        },
        {
          icon: 'Link',
          title: 'Every answer cites its source',
          description:
            'Results link back to the meeting transcript, email thread, or note they came from. You always know where the information originated.',
        },
        {
          icon: 'Database',
          title: 'Gets more useful over time',
          description:
            'The longer you use Ozer, the richer your knowledge layer becomes. Your entire professional history — searchable and connected.',
        },
      ],
      connectedTo: [
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Notes', href: '/features/notes' },
        { label: 'Projects', href: '/features/project-management' },
      ],
      connectionHeading: 'Built from everything, not just some things',
      connectionDescription:
        'The second brain indexes across all of Ozer — so a search surfaces the relevant email, the meeting where it was discussed, and the project it belongs to, all at once.',
      faqs: [
        {
          question: 'Do I need to do anything to set it up?',
          answer:
            "No. Indexing happens automatically in the background as you use Ozer. There's nothing to configure or import.",
        },
        {
          question: 'Can I search across old meetings and emails?',
          answer:
            "Yes. Historical content is indexed when you connect your accounts. How far back depends on your Gmail history and how long you've been using Ozer.",
        },
        {
          question: 'Is this the same as a vector search or RAG system?',
          answer:
            'Under the hood, yes — Ozer uses vector embeddings to index your content and retrieval-augmented generation to answer queries. For you, it just works like a very smart search box.',
        },
      ],
    },
  },
  messaging: {
    slug: 'messaging',
    name: 'Messaging',
    shortDescription:
      'Client and team messaging tied to the projects they belong to.',
    indexIcon: 'MessageSquare',
    primaryKeyword: 'client messaging software for agencies',
    metadata: {
      title: 'Client Messaging Software for Agencies | Ozer',
      description:
        "Client and team messaging that lives inside your projects — not in a separate app, not in WhatsApp. Every conversation connected to the work it's about.",
      keywords: [
        'client messaging software for agencies',
        'client communication tool',
        'agency client chat',
        'freelance messaging app',
      ],
      canonical: 'https://ozer.so/features/messaging',
      openGraphTitle: 'Client Messaging Software for Agencies | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Client Messaging Software for Agencies',
      description:
        "Client and team messaging that lives inside your projects — not in a separate app, not in WhatsApp. Every conversation connected to the work it's about.",
      url: 'https://ozer.so/features/messaging',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Messaging',
      heading:
        'Client Messaging That Belongs in Your Project — Not Your Personal DMs',
      subheading:
        "Direct messaging with clients and your team, tied to the projects they're about. No context-switching, no digging through WhatsApp threads to find what was agreed.",
      highlights: [
        {
          icon: 'MessageSquare',
          title: 'Per-project threads',
          description:
            "Conversations live next to the work they're about. Open a project and every message, task, file, and invoice is right there — in context.",
        },
        {
          icon: 'Users',
          title: 'Client-facing and internal',
          description:
            'Separate channels for client communication and internal team notes. Clients see what they should. Your team sees everything.',
        },
        {
          icon: 'History',
          title: 'Full conversation history',
          description:
            'Every message in a project is searchable and permanent. No more scrolling through months of WhatsApp to find the approval that was sent in April.',
        },
        {
          icon: 'ShieldCheck',
          title: 'Professional by default',
          description:
            'Keep client communication in a dedicated, professional channel. Your personal phone stays personal.',
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Client Portals', href: '/features/client-portals' },
        { label: 'Files', href: '/features/notes' },
        { label: 'Second Brain', href: '/features/second-brain' },
      ],
      connectionHeading: "Messaging that's part of the project record",
      connectionDescription:
        'Every message is tied to a client and project — so the conversation is always findable, always in context, and never lost in a personal inbox.',
      faqs: [
        {
          question: 'Does this replace email?',
          answer:
            "It's a complement to email, not a replacement. Use messaging for quick back-and-forth with clients or your team, and email for more formal communication. Both live in Ozer.",
        },
        {
          question: 'Can clients message me directly?',
          answer:
            'Yes. Clients access messaging through their portal. You can decide per-project whether messaging is enabled for the client.',
        },
      ],
    },
  },
  notes: {
    slug: 'notes',
    name: 'Notes',
    shortDescription:
      'Project and client notes that stay connected to your work.',
    indexIcon: 'StickyNote',
    primaryKeyword: 'notes app for freelancers',
    metadata: {
      title: 'Notes App for Freelancers | Ozer',
      description:
        'Quick notes, meeting summaries, and ideas — stored in Ozer and connected to the right client or project. Not floating in a separate app.',
      keywords: [
        'notes app for freelancers',
        'project notes software',
        'client notes tool',
        'freelance notes',
        'business notes app',
      ],
      canonical: 'https://ozer.so/features/notes',
      openGraphTitle: 'Notes App for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Notes App for Freelancers',
      description:
        'Quick notes, meeting summaries, and ideas — stored in Ozer and connected to the right client or project. Not floating in a separate app.',
      url: 'https://ozer.so/features/notes',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Notes',
      heading: "Notes That Live Next to the Work They're About",
      subheading:
        'Quick capture, meeting summaries, and ideas — stored in Ozer and connected to the right client or project. Not floating somewhere separate.',
      highlights: [
        {
          icon: 'StickyNote',
          title: 'Attached to projects and clients',
          description:
            'Every note belongs to something. Open a client record or project and the relevant notes are right there — not buried in a notes app you have to search separately.',
        },
        {
          icon: 'Zap',
          title: "Quick capture that doesn't break flow",
          description:
            'Jot something down in seconds without losing your place. Add it to the right project or client later, or let Ozer suggest where it belongs.',
        },
        {
          icon: 'Search',
          title: 'Searchable via second brain',
          description:
            "Every note is indexed automatically. Ask Ozer a question and it'll surface the relevant notes alongside your emails and meeting transcripts.",
        },
        {
          icon: 'Mic',
          title: 'Synced from meetings',
          description:
            'Ozer Assistant syncs meeting notes directly into the right project after every call. Notes capture happens automatically — no copy-pasting after the fact.',
        },
      ],
      connectedTo: [
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Second Brain', href: '/features/second-brain' },
        { label: 'Planner', href: '/features/planner' },
      ],
      connectionHeading:
        'Notes that are part of the project, not separate from it',
      connectionDescription:
        'A note about a client meeting that lives in the client record is useful. The same note in a separate app is just more noise.',
      faqs: [
        {
          question: 'Is this a replacement for Notion or Apple Notes?',
          answer:
            "For client and project-related notes, yes — and the advantage is that they're connected to your actual work in Ozer. For personal journalling or knowledge management outside of work, you might still use something else alongside it.",
        },
        {
          question: 'Can I format notes with headings and lists?',
          answer:
            'Yes. Notes support markdown formatting — headings, bullet points, checklists, and more.',
        },
      ],
    },
  },
  'project-management': {
    slug: 'project-management',
    name: 'Project Management',
    shortDescription:
      'Jobs, phases, timelines, and deliverables — tied to clients and tasks.',
    indexIcon: 'FolderKanban',
    primaryKeyword: 'project management for freelancers',
    metadata: {
      title: 'Project Management for Freelancers | Ozer',
      description:
        'Run client projects with phases, timelines, priorities, and tasks in one place. Table and timeline views, linked to clients, contracts, and invoices.',
      keywords: [
        'project management for freelancers',
        'agency project management',
        'freelance job tracking',
        'client project software',
      ],
      canonical: 'https://ozer.so/features/project-management',
      openGraphTitle: 'Project Management for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Project Management for Freelancers',
      description:
        'Jobs, phases, timelines, and deliverables connected to clients, tasks, and invoices.',
      url: 'https://ozer.so/features/project-management',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Projects',
      heading: 'Project Management That Stays Connected to Everything Else',
      subheading:
        'Track jobs with phases, deadlines, and priorities — in a table or timeline. Every project links to the client, tasks, contracts, files, and invoices it belongs to.',
      highlights: [
        {
          icon: 'FolderKanban',
          title: 'Table and timeline views',
          description:
            'See all active work in a sortable table or drag-friendly timeline. Filter by client, status, or priority without exporting to a separate PM tool.',
        },
        {
          icon: 'Layers',
          title: 'Phases and deliverables',
          description:
            'Break projects into phases with due dates and task lists. Know what stage each job is in and what ships next.',
        },
        {
          icon: 'Users',
          title: 'Client context built in',
          description:
            'Open a project and the client record, messages, portal, and history are right there. No hunting across apps for who this work is for.',
        },
        {
          icon: 'ArrowRight',
          title: 'From pipeline to delivery',
          description:
            'Won deals convert into projects automatically. The brief and contact details carry over — you start executing, not re-entering.',
        },
      ],
      connectedTo: [
        { label: 'Pipeline', href: '/features/pipeline' },
        { label: 'Tasks', href: '/features/tasks' },
        { label: 'Planner', href: '/features/planner' },
        { label: 'Contracts', href: '/features/contracts' },
        { label: 'Invoicing', href: '/features/invoicing' },
      ],
      connectionHeading: 'Projects at the centre of your workflow',
      connectionDescription:
        'Tasks, meetings, invoices, and portals all hang off the same project record — so nothing drifts out of sync.',
      faqs: [
        {
          question: 'How is this different from the pipeline?',
          answer:
            'Pipeline tracks sales opportunities before you win the work. Project management is where delivery happens — phases, tasks, timelines, and handoffs after the deal is signed.',
        },
        {
          question: 'Can I manage multiple projects per client?',
          answer:
            'Yes. Each client can have as many active projects as you need, each with its own phases, tasks, and financials.',
        },
      ],
    },
  },
  tasks: {
    slug: 'tasks',
    name: 'Tasks',
    shortDescription:
      'Unified task list across workspaces — linked to clients, projects, and your planner.',
    indexIcon: 'CheckSquare',
    primaryKeyword: 'task management for freelancers',
    metadata: {
      title: 'Task Management for Freelancers | Ozer',
      description:
        'One task list across personal life and every workspace. Link tasks to clients and projects, prioritise by due date, and feed your daily planner automatically.',
      keywords: [
        'task management for freelancers',
        'agency task list',
        'unified task manager',
        'client task tracking',
      ],
      canonical: 'https://ozer.so/features/tasks',
      openGraphTitle: 'Task Management for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Task Management for Freelancers',
      description:
        'Unified tasks linked to clients, projects, and AI planner.',
      url: 'https://ozer.so/features/tasks',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Tasks',
      heading: 'One Task List for Every Workspace — Without Losing Context',
      subheading:
        'See work and life tasks in one place, or filter by workspace. Every task can link to a client, project, or area — and flows straight into your daily planner.',
      highlights: [
        {
          icon: 'CheckSquare',
          title: 'Cross-workspace list',
          description:
            'Personal, business, family, and community tasks in one view — or scoped to a single workspace when you need focus.',
        },
        {
          icon: 'Users',
          title: 'Client and project links',
          description:
            'Assign tasks to a client or project so they appear in the right job record, not as orphan to-dos in a generic list.',
        },
        {
          icon: 'CalendarDays',
          title: 'Feeds the planner',
          description:
            'Open tasks with due dates surface in the AI planner automatically. Plan your day from real work, not a duplicate list.',
        },
        {
          icon: 'Sparkles',
          title: 'Created from meetings and email',
          description:
            'Ozer Assistant and Email Assistant extract action items into tasks — review once, then they live in your list until done.',
        },
      ],
      connectedTo: [
        { label: 'Planner', href: '/features/planner' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
      ],
      connectionHeading: 'Tasks that know what they belong to',
      connectionDescription:
        'A task linked to a project updates the project. A task in your planner comes from the same list. One source of truth.',
      faqs: [
        {
          question: 'Can I use tasks without project management?',
          answer:
            'Yes. Tasks work standalone — link them to life areas, clients, or projects depending on what you need.',
        },
        {
          question: 'Do subtasks work?',
          answer:
            'Yes. Break larger tasks into subtasks with their own status and due dates.',
        },
      ],
    },
  },
  contracts: {
    slug: 'contracts',
    name: 'Contracts',
    shortDescription:
      'Send, sign, and track client contracts — linked to projects and clients.',
    indexIcon: 'FileSignature',
    primaryKeyword: 'contract management for freelancers',
    metadata: {
      title: 'Contract Management for Freelancers | Ozer',
      description:
        'Create client contracts, send for signature, and track status — connected to the client and project they belong to. No separate e-sign tool required.',
      keywords: [
        'contract management for freelancers',
        'freelance contract software',
        'client contract e-sign',
        'agency contracts',
      ],
      canonical: 'https://ozer.so/features/contracts',
      openGraphTitle: 'Contract Management for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Contract Management for Freelancers',
      description:
        'Send, sign, and track client contracts linked to projects.',
      url: 'https://ozer.so/features/contracts',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Contracts',
      heading: 'Client Contracts That Live Inside Your Project — Not in Another App',
      subheading:
        'Draft agreements, send them for signature, and track who has signed — all connected to the client record and the project they govern.',
      highlights: [
        {
          icon: 'FileSignature',
          title: 'Send and collect signatures',
          description:
            'Clients sign via a secure portal link. You see sent, viewed, and signed status without chasing PDFs over email.',
        },
        {
          icon: 'Users',
          title: 'Tied to the client',
          description:
            'Every contract belongs to a client record. Open the relationship and see every agreement alongside invoices and messages.',
        },
        {
          icon: 'FolderKanban',
          title: 'Linked to projects',
          description:
            'Attach contracts to the jobs they cover. When work starts, the signed terms are already in context.',
        },
        {
          icon: 'CreditCard',
          title: 'Payment plans optional',
          description:
            'Structure contracts with totals and payment milestones that align with how you invoice downstream.',
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Client Portals', href: '/features/client-portals' },
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Pipeline', href: '/features/pipeline' },
      ],
      connectionHeading: 'Signed terms before the work begins',
      connectionDescription:
        'Win the deal, send the contract, start the project — all in one system without copying client details into a separate e-sign tool.',
      faqs: [
        {
          question: 'Do clients need an Ozer account to sign?',
          answer:
            'No. Clients sign via a secure link in their portal — the same experience as reviewing deliverables.',
        },
        {
          question: 'Can I track unsigned contracts?',
          answer:
            'Yes. Filter by draft, sent, and signed status so nothing waiting on a signature gets forgotten.',
        },
      ],
    },
  },
  sops: {
    slug: 'sops',
    name: 'SOPs',
    shortDescription:
      'Playbooks and checklists your team runs every month or project.',
    indexIcon: 'ListChecks',
    primaryKeyword: 'SOP software for agencies',
    metadata: {
      title: 'SOPs & Playbooks for Agencies | Ozer',
      description:
        'Document repeatable processes as playbooks, then run them as checklists each month or project. AI import, assignees, and run history built in.',
      keywords: [
        'SOP software for agencies',
        'agency playbooks',
        'standard operating procedures',
        'agency checklists',
      ],
      canonical: 'https://ozer.so/features/sops',
      openGraphTitle: 'SOPs & Playbooks for Agencies | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'SOPs & Playbooks for Agencies',
      description:
        'Document processes once, run them as checklists with assignees and history.',
      url: 'https://ozer.so/features/sops',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer SOPs',
      heading: 'Playbooks Your Team Actually Runs — Not PDFs That Gather Dust',
      subheading:
        'Document a process once as a playbook, then launch it as a checklist run each month, week, or project. Assign steps, track completion, and keep a history of every run.',
      highlights: [
        {
          icon: 'ListChecks',
          title: 'Playbook library',
          description:
            'Organise SOPs by category — onboarding, monthly close, campaign launch, or anything repeatable. One source of truth for how your agency works.',
        },
        {
          icon: 'RefreshCw',
          title: 'Recurring and per-project runs',
          description:
            'Schedule monthly or weekly runs, or attach a checklist to a specific project kickoff. The right steps at the right time.',
        },
        {
          icon: 'Users',
          title: 'Assignees per step',
          description:
            'Hand each checklist item to a team member. Everyone knows what they own without a separate project management spreadsheet.',
        },
        {
          icon: 'Sparkles',
          title: 'AI import from docs',
          description:
            'Paste an existing process doc and Ozer structures it into steps — faster than building checklists from scratch.',
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Tasks', href: '/features/tasks' },
        { label: 'Planner', href: '/features/planner' },
        { label: 'Second Brain', href: '/features/second-brain' },
      ],
      connectionHeading: 'Process knowledge that connects to delivery',
      connectionDescription:
        'SOPs suggested in the planner, linked to projects, and searchable in your second brain — not trapped in a folder nobody opens.',
      faqs: [
        {
          question: 'Can I run the same playbook multiple times?',
          answer:
            'Yes. Each run is a separate checklist instance with its own completion state and history — so you can see what was done last month vs this month.',
        },
        {
          question: 'Does the planner suggest relevant SOPs?',
          answer:
            'Yes. When planning your day or week, Ozer can surface playbooks that match the work on your plate.',
        },
      ],
    },
  },
  pipeline: {
    slug: 'pipeline',
    name: 'Pipeline',
    shortDescription:
      'Track leads and proposals — win a deal and it becomes a project.',
    indexIcon: 'Kanban',
    primaryKeyword: 'CRM pipeline for freelancers',
    metadata: {
      title: 'CRM Pipeline for Freelancers | Ozer',
      description:
        'Track leads, manage proposals, and convert prospects — and when you win the deal, it becomes a project automatically. No re-entering anything.',
      keywords: [
        'CRM pipeline for freelancers',
        'agency CRM software',
        'freelance sales pipeline',
        'lead tracking for freelancers',
        'agency pipeline tool',
      ],
      canonical: 'https://ozer.so/features/pipeline',
      openGraphTitle: 'CRM Pipeline for Freelancers | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'CRM Pipeline for Freelancers',
      description:
        'Track leads, manage proposals, and convert prospects — and when you win the deal, it becomes a project automatically. No re-entering anything.',
      url: 'https://ozer.so/features/pipeline',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Pipeline',
      heading: 'A CRM Pipeline for Freelancers Who Actually Win Business',
      subheading:
        'Track leads, manage proposals, and move opportunities forward — and when you win, the deal converts directly into a project. No starting from scratch.',
      highlights: [
        {
          icon: 'Kanban',
          title: 'Visual pipeline at a glance',
          description:
            "See every opportunity from first contact to signed — in one board. Know exactly what's active, what's stalled, and what needs a nudge.",
        },
        {
          icon: 'FileSignature',
          title: 'Proposal tracking',
          description:
            'Know when a prospect has viewed your proposal. Follow up with confidence — not blind guessing.',
        },
        {
          icon: 'ArrowRight',
          title: 'Win → Project, automatically',
          description:
            'Close a deal and it converts into a project with one click. The client record, brief, and context carry straight over. Nothing to re-enter.',
        },
        {
          icon: 'Clock',
          title: 'Client history from day one',
          description:
            'The relationship record starts the moment a lead enters your pipeline. By the time you kick off, you already have full context.',
        },
      ],
      connectedTo: [
        { label: 'Project Management', href: '/features/project-management' },
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Clients', href: '/features/client-portals' },
      ],
      connectionHeading: 'Where client relationships begin',
      connectionDescription:
        'The pipeline is the start of the Ozer client lifecycle — lead becomes client, client becomes project, project generates invoice. All connected.',
      faqs: [
        {
          question: 'Is this a full CRM?',
          answer:
            "It's a CRM built for the scale of a freelancer or small agency. You get pipeline management, contact records, proposal tracking, and the connection to your projects — without the complexity of enterprise CRM software.",
        },
        {
          question: 'Can I track multiple leads per client?',
          answer:
            'Yes. Each client can have multiple pipeline entries for separate projects or opportunities.',
        },
      ],
    },
  },
  finances: {
    slug: 'finances',
    name: 'Finances',
    shortDescription:
      'Revenue, cash flow, and project profitability — with optional FreeAgent sync.',
    indexIcon: 'BarChart3',
    primaryKeyword: 'freelance finance management',
    heroBadge: 'FreeAgent integration available',
    metadata: {
      title: 'Freelance Finance Management | Ozer',
      description:
        'See your real financial health — revenue, outstanding invoices, bank transactions, and project profitability. Connect FreeAgent to sync categories and explanations automatically.',
      keywords: [
        'freelance finance management',
        'agency financial dashboard',
        'FreeAgent integration',
        'freelance accounting tool',
        'income tracker for freelancers',
      ],
      canonical: 'https://ozer.so/features/finances',
      openGraphTitle: 'Freelance Finance Management | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Freelance Finance Management',
      description:
        'Revenue, outstanding invoices, and project profitability connected to your work — with FreeAgent bank sync for UK freelancers.',
      url: 'https://ozer.so/features/finances',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Finances',
      heading: 'Operational Finance Connected to Your Projects — and FreeAgent',
      subheading:
        'Revenue, outstanding invoices, and project profitability in one view. Connect FreeAgent to pull bank transactions and categories into Ozer so your operational dashboard stays in sync with your books.',
      highlights: [
        {
          icon: 'BarChart3',
          title: 'Revenue at a glance',
          description:
            "What you've earned, what's outstanding, and what's forecast — in one dashboard. No opening a spreadsheet to do the maths yourself.",
        },
        {
          icon: 'PieChart',
          title: 'Per-project profitability',
          description:
            'Know which clients and projects are actually worth your time. See the revenue and time invested per project side by side.',
        },
        {
          icon: 'RefreshCw',
          title: 'FreeAgent bank sync',
          description:
            'Connect your FreeAgent account to import bank transactions and category explanations. Ozer keeps your finance view aligned with what your accountant sees.',
        },
        {
          icon: 'Link',
          title: 'Secure OAuth connection',
          description:
            'Authorise Ozer to read your FreeAgent company data. Tokens refresh automatically — no manual re-auth unless you disconnect.',
        },
        {
          icon: 'FolderKanban',
          title: 'Categories mapped to Ozer',
          description:
            'FreeAgent chart-of-accounts categories sync into Ozer so AI categorisation and reporting speak the same language as your books.',
        },
        {
          icon: 'AlertTriangle',
          title: 'Outstanding payments, surfaced',
          description:
            "Invoices that haven't been paid don't stay hidden. Ozer surfaces what's overdue so you can chase it — without building a chasing system yourself.",
        },
      ],
      connectedTo: [
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Pipeline', href: '/features/pipeline' },
      ],
      connectionHeading: 'Finances built from your real work',
      connectionDescription:
        'Every number traces back to a project, client, or invoice — and with FreeAgent connected, bank activity flows in automatically.',
      faqs: [
        {
          question: 'Does Ozer replace FreeAgent or my accountant?',
          answer:
            "No. Ozer gives you the day-to-day operational view — what's owed, what's paid, which projects are profitable. FreeAgent remains your books. Ozer syncs from it so you don't duplicate data entry.",
        },
        {
          question: 'What does the FreeAgent integration sync?',
          answer:
            'Bank accounts, transactions, and category explanations from FreeAgent import into Ozer on a schedule. You get a unified finance dashboard without manually exporting CSVs.',
        },
        {
          question: 'Do I need a FreeAgent account?',
          answer:
            'Only if you want the integration. Ozer Finances works on its own for revenue, invoices, and project profitability. FreeAgent sync is optional for UK users who already keep their books there.',
        },
        {
          question: 'Is the FreeAgent integration UK-only?',
          answer:
            'FreeAgent is built for UK small businesses, so the bank sync integration is aimed at UK freelancers and agencies using FreeAgent today.',
        },
        {
          question: 'Can I disconnect FreeAgent at any time?',
          answer:
            'Yes. Disconnect FreeAgent from workspace settings. Previously imported transactions remain in Ozer unless you choose to remove them.',
        },
        {
          question: 'Is financial data included in the second brain?',
          answer:
            "Invoice history and project financials are part of your Ozer record and accessible via search — so you can ask things like 'what did Thistleleaf spend last quarter' and get an answer.",
        },
      ],
    },
  },
};

export function getFeaturePageConfig(slug: FeatureSlug): FeaturePageConfig {
  return FEATURE_PAGES[slug];
}

export function listFeaturePageConfigs(): FeaturePageConfig[] {
  return FEATURE_INDEX_ORDER.map((slug) => FEATURE_PAGES[slug]);
}

export function buildFeaturePageMetadata(slug: FeatureSlug): Metadata {
  const config = getFeaturePageConfig(slug);
  const { metadata } = config;

  return {
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    alternates: {
      canonical: metadata.canonical,
    },
    openGraph: {
      title: metadata.openGraphTitle,
      description: metadata.description,
      url: metadata.canonical,
      type: 'website',
    },
  };
}

export function buildFeatureFaqJsonLd(faqs: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
