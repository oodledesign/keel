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
  | 'client-portals'
  | 'invoicing'
  | 'second-brain'
  | 'messaging'
  | 'notes'
  | 'pipeline'
  | 'finances';

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
};

export const FEATURE_INDEX_ORDER: FeatureSlug[] = [
  'planner',
  'email-assistant',
  'desktop-assistant',
  'client-portals',
  'invoicing',
  'second-brain',
  'messaging',
  'notes',
  'pipeline',
  'finances',
];

export const FEATURE_SITEMAP_PATHS = [
  '/features',
  ...FEATURE_INDEX_ORDER.map((slug) => `/features/${slug}`),
] as const;

export const FEATURE_NAV_GROUPS = [
  {
    label: 'Work',
    items: [
      { label: 'Planner', href: '/features/planner' },
      { label: 'Pipeline', href: '/features/pipeline' },
      { label: 'Projects', href: '/features/pipeline' },
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
    label: 'Intelligence',
    items: [
      { label: 'Email Assistant', href: '/features/email-assistant' },
      { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
      { label: 'Second Brain', href: '/features/second-brain' },
      { label: 'Notes', href: '/features/notes' },
      { label: 'Finances', href: '/features/finances' },
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
        { label: 'Projects', href: '/features/pipeline' },
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
        { label: 'Projects', href: '/features/pipeline' },
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
      'Mac meeting notes, transcription, dictation, and follow-up automation.',
    indexIcon: 'Mic',
    primaryKeyword: 'meeting notes desktop app Mac',
    metadata: {
      title: 'Meeting Notes Desktop App for Mac | Ozer Assistant',
      description:
        'Ozer Assistant records any call or in-person meeting, separates speakers automatically, extracts tasks, drafts follow-up emails, and logs everything to your second brain.',
      keywords: [
        'meeting notes desktop app Mac',
        'AI meeting recorder Mac',
        'in-person meeting transcription',
        'Mac dictation app',
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
        'macOS desktop app that records any call or in-person meeting, separates speakers, transcribes with AI, and syncs everything to Ozer.',
      url: 'https://ozer.so/features/desktop-assistant',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Assistant',
      heading:
        'The Meeting Notes App That Actually Does Something With Your Transcripts',
      subheading:
        'Records any call or in-room meeting on your Mac, separates speakers automatically, then turns the conversation into tasks, follow-up emails, and searchable knowledge — without you lifting a finger.',
      highlights: [
        {
          icon: 'Mic',
          title: 'Any call. Any room.',
          description:
            'Works across Zoom, Google Meet, Teams, or any app on your Mac. And for in-person meetings, it separates speakers from a single microphone — so you know who said what, even in the room.',
        },
        {
          icon: 'Keyboard',
          title: 'Dictate into anything',
          description:
            "Press fn anywhere on your Mac and speak. Ozer Assistant types your words into whatever input you're focused on — with correct punctuation and grammar. Or hit copy and paste it yourself.",
        },
        {
          icon: 'CalendarDays',
          title: 'Calendar-connected',
          description:
            'Meeting reminders arrive before calls start. Client name, project, and context are autofilled from your calendar before you hit record.',
        },
        {
          icon: 'Zap',
          title: 'Tasks, emails, and memory',
          description:
            'When the call ends, action items are extracted into your project, a follow-up email is drafted, and the full transcript is indexed in your second brain — searchable forever.',
        },
      ],
      connectedTo: [
        { label: 'Calendar', href: '/features/planner' },
        { label: 'Projects', href: '/features/pipeline' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Second Brain', href: '/features/second-brain' },
        { label: 'Notes', href: '/features/notes' },
      ],
      connectionHeading: 'Not a standalone app — the meeting layer of Ozer',
      connectionDescription:
        'Ozer Assistant feeds directly into your projects, inbox, and knowledge base. Every meeting becomes part of your workflow, not a break from it.',
      faqs: [
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
            'Currently yes — Ozer Assistant is a native macOS app. Windows support is on the roadmap.',
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
        { label: 'Projects', href: '/features/pipeline' },
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
        { label: 'Projects', href: '/features/pipeline' },
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
        { label: 'Projects', href: '/features/pipeline' },
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
        { label: 'Projects', href: '/features/pipeline' },
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
        { label: 'Projects', href: '/features/pipeline' },
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
        { label: 'Projects', href: '/features/planner' },
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
      'Revenue, outstanding invoices, and project profitability in one view.',
    indexIcon: 'BarChart3',
    primaryKeyword: 'freelance finance management',
    metadata: {
      title: 'Freelance Finance Management | Ozer',
      description:
        'See your real financial health — revenue, outstanding invoices, and project profitability — connected to your actual work. Not a separate accounting app.',
      keywords: [
        'freelance finance management',
        'agency financial dashboard',
        'freelance accounting tool',
        'income tracker for freelancers',
        'freelance revenue dashboard',
      ],
      canonical: 'https://ozer.so/features/finances',
      openGraphTitle: 'Freelance Finance Management | Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Freelance Finance Management',
      description:
        'See your real financial health — revenue, outstanding invoices, and project profitability — connected to your actual work. Not a separate accounting app.',
      url: 'https://ozer.so/features/finances',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Finances',
      heading: 'See the Real Financial Health of Your Freelance Business',
      subheading:
        'Revenue, outstanding invoices, and project profitability — all connected to your actual work. Not pulled from a spreadsheet, not living in a separate accounting app.',
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
          icon: 'AlertTriangle',
          title: 'Outstanding payments, surfaced',
          description:
            "Invoices that haven't been paid don't stay hidden. Ozer surfaces what's overdue so you can chase it — without building a chasing system yourself.",
        },
        {
          icon: 'Link',
          title: 'Connected to real project data',
          description:
            "Financial figures come directly from your projects and invoices. Nothing is manually entered into a finance view that doesn't know what the rest of Ozer knows.",
        },
      ],
      connectedTo: [
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Projects', href: '/features/planner' },
        { label: 'Clients', href: '/features/client-portals' },
        { label: 'Pipeline', href: '/features/pipeline' },
      ],
      connectionHeading: 'Finances built from your real work',
      connectionDescription:
        'Every number in your finances view traces back to a real project, a real client, and a real invoice — not a manual entry.',
      faqs: [
        {
          question: 'Does Ozer replace my accountant or accounting software?',
          answer:
            "Not entirely — Ozer gives you the operational financial view (what's owed, what's paid, which projects are profitable). For tax returns and formal accounting, you'd still use your accountant or software like Xero. Ozer can export data for this.",
        },
        {
          question: 'Can I track expenses as well as revenue?',
          answer:
            'Expense tracking is on the roadmap. Initially, Ozer Finances focuses on revenue, invoicing, and project profitability.',
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
