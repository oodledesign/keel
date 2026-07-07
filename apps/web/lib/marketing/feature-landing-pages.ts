import type { Metadata } from 'next';

import type {
  ConnectedFeature,
  FAQItem,
  FeatureHighlight,
} from '~/(marketing)/_components/FeatureLandingPage';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';

export type FeatureSlug =
  | 'planner'
  | 'email-assistant'
  | 'desktop-assistant'
  | 'dictation'
  | 'activity'
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

export type FeatureRelatedLink = {
  href: string;
  label: string;
};

export type FeaturePageConfig = {
  slug: FeatureSlug;
  name: string;
  shortDescription: string;
  indexIcon: string;
  primaryKeyword: string;
  /** 40–60 word direct answer under the H1 (answer engines / snippets). */
  answerFirst: string;
  /** Descriptive-anchor link to a relevant blog entry or index. */
  relatedBlog: FeatureRelatedLink;
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    canonical: string;
    openGraphTitle: string;
  };
  /** @deprecated Prefer shared builders in feature-page-view. */
  jsonLd?: Record<string, unknown>;
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
  'activity',
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
      { label: 'Activity tracking', href: '/features/activity' },
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
      'Today’s work, pulled from real projects and deadlines.',
    indexIcon: 'CalendarDays',
    primaryKeyword: 'daily planner for freelancers',
  answerFirst:
    'Ozer planner shows what to work on today by reading your projects, client deadlines, and calendar. It is not a separate to-do list. Tasks stay on the job record and overdue work surfaces early. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on planning the day on the Ozer blog',
  },
    metadata: {
      title: 'Today plan from real projects — Ozer',
      description:
        "Ozer's planner shows what to work on today from your projects, client deadlines, and calendar — not a separate to-do list you keep in sync.",
      keywords: [
        'daily planner for freelancers',
        'task planner for agencies',
        'daily focus planner',
        'freelance task manager',
      ],
      canonical: 'https://ozer.so/features/planner',
      openGraphTitle: 'Today plan from real projects — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Daily Planner for Freelancers',
      description:
        "Ozer's planner shows what to work on today from your projects, client deadlines, and calendar.",
      url: 'https://ozer.so/features/planner',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Planner',
      heading: 'Today’s plan from real work',
      subheading:
        'Ozer’s planner answers “what should I do today?” by reading your projects, deadlines, and calendar. One view. No second to-do app.',
      highlights: [
        {
          icon: 'Sun',
          title: 'Today, not a backlog',
          description:
            'Everything due or overdue today in one list — from active projects, not a list you maintain by hand.',
        },
        {
          icon: 'FolderKanban',
          title: 'Tasks stay on the project',
          description:
            'Finish a task and the project updates. Your plan and delivery stay the same record.',
        },
        {
          icon: 'CalendarDays',
          title: 'Meetings block the day',
          description:
            'Ozer plans around what’s already in your calendar, not on top of it.',
        },
        {
          icon: 'AlertCircle',
          title: 'Slippage surfaces early',
          description:
            'Overdue work and tight deadlines rise to the top so you chase less.',
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Calendar', href: '/features/desktop-assistant' },
        { label: 'Pipeline', href: '/features/pipeline' },
        { label: 'Notes', href: '/features/notes' },
      ],
      connectionHeading: 'Planned from work you already have',
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
      'Inbox replies and tasks, with client context attached.',
    indexIcon: 'Sparkles',
    primaryKeyword: 'AI email assistant for freelancers',
  answerFirst:
    'Ozer email assistant links inbox threads to clients and projects, drafts replies with that history, and turns client asks into tasks. Mail stays in Gmail; action lives in Ozer. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on client email on the Ozer blog',
  },
    metadata: {
      title: 'Client-aware email assistant — Ozer',
      description:
        "Ozer's email assistant connects your inbox to your clients and projects. AI that drafts replies, extracts action items, and gives every email the context it needs.",
      keywords: [
        'AI email assistant for freelancers',
        'email management for agencies',
        'client email tool',
        'AI inbox for freelancers',
      ],
      canonical: 'https://ozer.so/features/email-assistant',
      openGraphTitle: 'Client-aware email assistant — Ozer',
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
        'Ozer’s email assistant answers “how do I handle client email without losing context?” Threads sit on the client and project. Drafts use that history. Asks become tasks.',
      highlights: [
        {
          icon: 'Users',
          title: 'Thread meets client record',
          description:
            'Open a message and the project, history, and open tasks are already beside it.',
        },
        {
          icon: 'Sparkles',
          title: 'Drafts with real context',
          description:
            'Replies know the client, the job, and what you agreed — less rewriting before you send.',
        },
        {
          icon: 'CheckSquare',
          title: 'Asks become tasks',
          description:
            'When a client asks for work, Ozer captures a task so it doesn’t die in the thread.',
        },
        {
          icon: 'Clock',
          title: 'History stays with the job',
          description:
            'Client email lives with the project, portal, and invoices — not only in Gmail search.',
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
        'When mail arrives, Ozer already knows the client, the project, and what’s outstanding.',
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
      'Mac app: meetings, dictation, and activity tracking — tasks and follow-ups without a separate stack.',
    indexIcon: 'Mic',
    primaryKeyword: 'meeting notes desktop app Mac',
  answerFirst:
    'Ozer Assistant for Mac records meetings, labels speakers, extracts tasks, and drafts follow-ups. Audio is processed on your Mac and is not kept as a permanent recording. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on meeting capture on the Ozer blog',
  },
    heroBadge: 'Native macOS app · Download for Mac',
    secondaryCta: {
      label: 'Download for Mac',
      href: '#early-access',
    },
    metadata: {
      title: 'Mac meeting notes to tasks — Ozer',
      description:
        'Ozer Assistant for Mac records meetings, labels speakers, extracts tasks. Audio is processed on your Mac.',
      keywords: [
        'meeting notes desktop app Mac',
        'AI meeting recorder Mac',
        'in-person meeting transcription',
        'Mac meeting notes download',
        'automatic meeting notes',
      ],
      canonical: 'https://ozer.so/features/desktop-assistant',
      openGraphTitle: 'Mac meeting notes to tasks — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Ozer Assistant',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'macOS',
      description:
        'Native macOS app that records meetings, separates speakers, extracts tasks, and syncs transcripts to Ozer. Audio is not kept as a permanent file.',
      url: 'https://ozer.so/features/desktop-assistant',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Assistant for Mac',
      heading:
        'Meetings become tasks on Mac',
      subheading:
        'Ozer’s meeting intelligence answers “what happened on that call?” Assistant records any call or room meeting, labels speakers, extracts tasks, and drafts the follow-up. Audio is processed on your Mac — we do not keep a permanent recording.',
      highlights: [
        {
          icon: 'Mic',
          title: 'Any call, any room',
          description:
            'Zoom, Meet, Teams, or the room mic. Speakers are labelled so you know who said what.',
        },
        {
          icon: 'CheckSquare',
          title: 'Tasks land on the list',
          description:
            'Action items go to Ozer, linked to the client and project. No retyping from notes.',
        },
        {
          icon: 'CalendarDays',
          title: 'Context before you record',
          description:
            'Reminders and client context come from your calendar before the call starts.',
        },
        {
          icon: 'Zap',
          title: 'Follow-up drafted',
          description:
            'When the call ends, a follow-up email draft and a searchable transcript are ready.',
        },
      ],
      connectedTo: [
        { label: 'Tasks', href: '/features/tasks' },
        { label: 'Calendar', href: '/features/planner' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Second Brain', href: '/features/second-brain' },
        { label: 'Dictation', href: '/features/dictation' },
        { label: 'Activity', href: '/features/activity' },
      ],
      connectionHeading: 'Meeting layer of the Workspace OS',
      connectionDescription:
        'Assistant feeds tasks, projects, inbox, and second brain — meetings are not a break from the system.',
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
      'Press fn, speak, get clean text in any Mac app.',
    indexIcon: 'Keyboard',
    primaryKeyword: 'voice dictation Mac app',
  answerFirst:
    'Ozer dictation is part of Assistant for Mac. Press fn in any text field, speak naturally, and get punctuated text where your cursor is without a separate window. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on Mac dictation on the Ozer blog',
  },
    heroBadge: 'Included in Ozer Assistant for Mac',
    secondaryCta: {
      label: 'Download for Mac',
      href: '#early-access',
    },
    metadata: {
      title: 'Mac dictation with punctuation — Ozer',
      description:
        'Press fn on Mac and dictate into any app. Ozer returns punctuated text as part of Assistant.',
      keywords: [
        'voice dictation Mac app',
        'Mac dictation software',
        'speech to text Mac',
        'dictation hotkey Mac',
        'AI dictation punctuation',
      ],
      canonical: 'https://ozer.so/features/dictation',
      openGraphTitle: 'Mac dictation with punctuation — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Ozer Assistant Dictation',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'macOS',
      description:
        'Global Mac dictation hotkey with punctuation and grammar, included in Ozer Assistant.',
      url: 'https://ozer.so/features/dictation',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Dictation',
      heading: 'Dictate into any Mac app',
      subheading:
        'Ozer dictation answers “how do I type faster without messy speech-to-text?” Press fn, speak naturally, and get punctuated text in the field you are in — Mail, Docs, Slack, or Ozer.',
      highlights: [
        {
          icon: 'Keyboard',
          title: 'Global fn hotkey',
          description:
            'Works in any Mac text field. No separate dictation window to copy from.',
        },
        {
          icon: 'Sparkles',
          title: 'Punctuation included',
          description:
            'Not raw speech-to-text. Sentences read like you typed them carefully.',
        },
        {
          icon: 'Clipboard',
          title: 'Type or copy',
          description:
            'Insert at the cursor, or copy to paste where you need it.',
        },
        {
          icon: 'History',
          title: 'Recent snippets in Ozer',
          description:
            'Reuse phrasing from earlier in the day without hunting chat logs.',
        },
      ],
      connectedTo: [
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Activity', href: '/features/activity' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Notes', href: '/features/notes' },
        { label: 'Second Brain', href: '/features/second-brain' },
      ],
      connectionHeading: 'Ships with Assistant for Mac',
      connectionDescription:
        'Same download as meeting recording — capture, tasks, and typing at speaking speed.',
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
  activity: {
    slug: 'activity',
    name: 'Activity tracking',
    shortDescription:
      'See where studio time goes — assign blocks to clients and projects.',
    indexIcon: 'Activity',
    primaryKeyword: 'automatic time tracking for freelancers',
    answerFirst:
      'Ozer activity tracking captures desktop app and website usage from Keel Assistant, groups sessions by app and domain, and lets you assign time to clients and projects. Privacy controls stay per workspace. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
    relatedBlog: {
      href: '/blog',
      label: 'Studio notes on time tracking on the Ozer blog',
    },
    heroBadge: 'Included in Ozer Assistant for Mac',
    secondaryCta: {
      label: 'Download for Mac',
      href: '#early-access',
    },
    metadata: {
      title: 'Desktop activity assigned to projects — Ozer',
      description:
        'Keel Assistant captures app and website activity on your Mac. Review sessions, assign to clients and projects, and see where studio time actually went.',
      keywords: [
        'automatic time tracking for freelancers',
        'desktop activity tracking Mac',
        'agency time tracking software',
        'client project time allocation',
        'freelance time tracking UK',
      ],
      canonical: 'https://ozer.so/features/activity',
      openGraphTitle: 'Desktop activity assigned to projects — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Ozer Activity Tracking',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'macOS',
      description:
        'Automatic desktop activity capture from Keel Assistant with assignment to clients and projects inside Ozer.',
      url: 'https://ozer.so/features/activity',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Activity',
      heading: 'Know where studio time went',
      subheading:
        'Ozer activity answers “what was I actually working on?” Keel Assistant captures app and website sessions on your Mac. Review by day, group by site, and assign blocks to the client or project they belong to — without a separate timer app.',
      highlights: [
        {
          icon: 'Monitor',
          title: 'Apps and websites captured',
          description:
            'Chrome, Figma, Cursor, Mail — sessions include domains and URLs when available.',
        },
        {
          icon: 'Users',
          title: 'Assign to client or project',
          description:
            'Confirm or adjust suggestions inline. Excluded time stays out of reports.',
        },
        {
          icon: 'Layers',
          title: 'Grouped by app and site',
          description:
            'Multiple sessions on github.com roll up together. Expand when you need detail.',
        },
        {
          icon: 'ShieldCheck',
          title: 'Privacy you control',
          description:
            'Turn tracking off per workspace. Sensitive apps can stay excluded from capture.',
        },
      ],
      connectedTo: [
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Finances', href: '/features/finances' },
        { label: 'Planner', href: '/features/planner' },
      ],
      connectionHeading: 'Time data on the project record',
      connectionDescription:
        'Activity blocks sit beside delivery and billing — so “how long did this take?” is answerable from the same system you run the job in.',
      faqs: [
        {
          question: 'Do I need Keel Assistant installed?',
          answer:
            'Yes. Activity is captured by Ozer Assistant for Mac and synced to your workspace. Install the desktop app, enable tracking in workspace settings, and upload from the menu bar.',
        },
        {
          question: 'Is everything on my Mac recorded?',
          answer:
            'Only foreground app activity you choose to track for that workspace. You can disable tracking entirely or exclude specific apps from settings.',
        },
        {
          question: 'Can my team see each other’s activity?',
          answer:
            'Members with permission can view team activity in the workspace. Your personal sessions stay on “My activity” unless you share a team view.',
        },
        {
          question: 'Does this replace invoicing or timesheets?',
          answer:
            'It informs them. Activity gives an honest picture of where time went so you can assign work to clients and projects — then raise invoices from the same job record.',
        },
      ],
    },
  },
  'client-portals': {
    slug: 'client-portals',
    name: 'Client Portals',
    shortDescription:
      'Branded client spaces that stay on the project.',
    indexIcon: 'LayoutDashboard',
    primaryKeyword: 'client portal software for agencies',
  answerFirst:
    'Ozer client portals give each client a branded space for files, updates, and approvals on the project record inside the Workspace OS. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on client portals on the Ozer blog',
  },
    metadata: {
      title: 'Client portals on the project — Ozer',
      description:
        "Give every client a professional portal — without logging into a separate tool. Ozer's client portals live inside your workflow and stay in sync with your projects automatically.",
      keywords: [
        'client portal software for agencies',
        'freelance client portal',
        'client portal tool',
        'agency client portal',
      ],
      canonical: 'https://ozer.so/features/client-portals',
      openGraphTitle: 'Client portals on the project — Ozer',
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
      heading: 'Portals inside your workflow',
      subheading:
        'Ozer client portals answer “how do clients see progress without email chaos?” Each client gets a branded space for files, updates, and sign-off — managed from the same project you already run.',
      highlights: [
        {
          icon: 'LayoutDashboard',
          title: 'One portal per client',
          description:
            'Share files and updates without another attachment thread.',
        },
        {
          icon: 'RefreshCw',
          title: 'Synced with the project',
          description:
            'Portal content follows the project. You do not update two systems.',
        },
        {
          icon: 'CheckCircle',
          title: 'Approvals in place',
          description:
            'Clients review and sign off in the portal — fewer version fights.',
        },
        {
          icon: 'Plug',
          title: 'Built in, not bolted on',
          description:
            'Portal, project, invoice, and messages share one client record.',
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
      'Raise invoices from the project. Chase what is unpaid.',
    indexIcon: 'FileText',
    primaryKeyword: 'invoicing software for freelancers',
  answerFirst:
    'Ozer invoicing raises invoices from the project with client details filled in. Outstanding amounts surface so you can chase payment without a second billing app. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on getting paid on the Ozer blog',
  },
    metadata: {
      title: 'Invoices from the project — Ozer',
      description:
        "Send invoices directly from your project — not from a separate app. Ozer's invoicing knows the client, the work, and what was agreed, because it's connected to everything else.",
      keywords: [
        'invoicing software for freelancers',
        'freelance invoice tool',
        'agency invoicing software',
        'invoice management freelancers',
      ],
      canonical: 'https://ozer.so/features/invoicing',
      openGraphTitle: 'Invoices from the project — Ozer',
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
      heading: 'Invoices from the project',
      subheading:
        "Invoicing that knows which project it's for, who the client is, and what was agreed — because it's connected to your actual work, not sitting in a separate system.",
      highlights: [
        {
          icon: 'FileText',
          title: 'One step from the job',
          description:
            'Raise an invoice on the project. Client, job name, and lines are ready.',
        },
        {
          icon: 'UserCheck',
          title: 'Client details once',
          description:
            'Address and contacts live on the client record — every invoice uses them.',
        },
        {
          icon: 'TrendingUp',
          title: 'See what is unpaid',
          description:
            'Outstanding invoices sit on the projects they belong to.',
        },
        {
          icon: 'Palette',
          title: 'Branded, professional PDFs',
          description:
            'Send invoices you are happy to put your name on.',
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Clients', href: '/features/pipeline' },
        { label: 'Finances', href: '/features/finances' },
        { label: 'Activity', href: '/features/activity' },
        { label: 'Client Portals', href: '/features/client-portals' },
      ],
      connectionHeading:
        "Invoicing that's part of the project, not separate from it",
      connectionDescription:
        'When a job wraps, invoicing is one step — not a switch to a blank form elsewhere.',
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
      'Ask what you agreed — answers cite meetings and mail.',
    indexIcon: 'Brain',
    primaryKeyword: 'second brain for freelancers',
  answerFirst:
    'Ozer second brain indexes meetings, email, notes, and projects. Ask in plain English and get answers with citations back to the source. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on searchable knowledge on the Ozer blog',
  },
    metadata: {
      title: 'Ask what you agreed — Ozer',
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
      openGraphTitle: 'Ask what you agreed — Ozer',
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
      heading: 'Ask what you agreed',
      subheading:
        'Ozer’s second brain answers “where did we decide that?” Meetings, email, notes, and projects are indexed as you work. Ask in plain English. Answers cite the source.',
      highlights: [
        {
          icon: 'Brain',
          title: 'Builds while you work',
          description:
            'No manual import ritual. Ozer indexes as you use the Workspace OS.',
        },
        {
          icon: 'Search',
          title: 'Plain-English questions',
          description:
            'Ask about a client or decision — get the answer, not a pile of files.',
        },
        {
          icon: 'Link',
          title: 'Every answer cites a source',
          description:
            'Jump to the transcript, thread, or note it came from.',
        },
        {
          icon: 'Database',
          title: 'Richer over time',
          description:
            'The longer you run Ozer, the more of your history is searchable.',
        },
      ],
      connectedTo: [
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Notes', href: '/features/notes' },
        { label: 'Projects', href: '/features/project-management' },
      ],
      connectionHeading: 'Built from the whole Workspace OS',
      connectionDescription:
        'One search can surface the email, the meeting, and the project together.',
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
      'Client and team chat on the project — not WhatsApp.',
    indexIcon: 'MessageSquare',
    primaryKeyword: 'client messaging software for agencies',
  answerFirst:
    'Ozer messaging keeps client and team chat on the project record so approvals do not live in personal WhatsApp. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on client chat on the Ozer blog',
  },
    metadata: {
      title: 'Project chat, not WhatsApp — Ozer',
      description:
        "Client and team messaging that lives inside your projects — not in a separate app, not in WhatsApp. Every conversation connected to the work it's about.",
      keywords: [
        'client messaging software for agencies',
        'client communication tool',
        'agency client chat',
        'freelance messaging app',
      ],
      canonical: 'https://ozer.so/features/messaging',
      openGraphTitle: 'Project chat, not WhatsApp — Ozer',
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
        'Chat on the project record',
      subheading:
        "Direct messaging with clients and your team, tied to the projects they're about. No context-switching, no digging through WhatsApp threads to find what was agreed.",
      highlights: [
        {
          icon: 'MessageSquare',
          title: 'Per-project threads',
          description:
            'Open the job and messages sit with tasks, files, and invoices.',
        },
        {
          icon: 'Users',
          title: 'Client and internal channels',
          description:
            'Clients see what they should. Your team sees the full thread.',
        },
        {
          icon: 'History',
          title: 'Searchable history',
          description:
            'Find the April approval without scrolling months of personal chat.',
        },
        {
          icon: 'ShieldCheck',
          title: 'Work stays professional',
          description:
            'Client talk stays in Ozer. Your phone stays personal.',
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
        'Every thread is tied to a client and project — findable and in context.',
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
      'Notes on the client or project they belong to.',
    indexIcon: 'StickyNote',
    primaryKeyword: 'notes app for freelancers',
  answerFirst:
    'Ozer notes attach to the client or project they belong to. Meeting notes land from Assistant and stay searchable in second brain. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on project notes on the Ozer blog',
  },
    metadata: {
      title: 'Notes on the job record — Ozer',
      description:
        'Notes attach to clients and projects, sync from meetings, and show up in second brain search.',
      keywords: [
        'notes app for freelancers',
        'project notes software',
        'client notes tool',
        'freelance notes',
        'business notes app',
      ],
      canonical: 'https://ozer.so/features/notes',
      openGraphTitle: 'Notes on the job record — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Notes App for Freelancers',
      description:
        'Project and client notes connected to work and searchable in Ozer.',
      url: 'https://ozer.so/features/notes',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Notes',
      heading: "Notes That Live Next to the Work They're About",
      subheading:
        'Ozer notes answer “where did I write that down?” Capture sits on the client or project. Meeting notes land automatically. Search finds them with everything else.',
      highlights: [
        {
          icon: 'StickyNote',
          title: 'Attached to work',
          description:
            'Open the client or project and the notes are there — not in another app.',
        },
        {
          icon: 'Zap',
          title: 'Quick capture',
          description:
            'Jot without losing flow. Assign to a project when you are ready.',
        },
        {
          icon: 'Search',
          title: 'Found via second brain',
          description:
            'Notes are indexed with mail and meetings.',
        },
        {
          icon: 'Mic',
          title: 'From meetings',
          description:
            'Assistant writes meeting notes onto the right project after the call.',
        },
      ],
      connectedTo: [
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Second Brain', href: '/features/second-brain' },
        { label: 'Planner', href: '/features/planner' },
      ],
      connectionHeading:
        'Notes on the project record',
      connectionDescription:
        'A note on the client record is useful. The same note in a separate app is noise.',
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
      'Jobs, phases, and timelines on the client record.',
    indexIcon: 'FolderKanban',
    primaryKeyword: 'project management for freelancers',
  answerFirst:
    'Ozer projects run jobs with phases, timelines, and tasks on the client record with contracts and invoices on the same job. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on delivery on the Ozer blog',
  },
    metadata: {
      title: 'Delivery on the client record — Ozer',
      description:
        'Jobs, phases, and timelines linked to clients, contracts, and invoices in one Workspace OS.',
      keywords: [
        'project management for freelancers',
        'agency project management',
        'freelance job tracking',
        'client project software',
      ],
      canonical: 'https://ozer.so/features/project-management',
      openGraphTitle: 'Delivery on the client record — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Project Management for Freelancers',
      description:
        'Jobs, phases, and timelines linked to clients, tasks, and invoices.',
      url: 'https://ozer.so/features/project-management',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Projects',
      heading: 'Delivery on the client record',
      subheading:
        'Ozer projects answer “where is this job?” Phases, deadlines, and tasks live with the client, contracts, and invoices — not in a PM tool that never sees the invoice.',
      highlights: [
        {
          icon: 'FolderKanban',
          title: 'Table and timeline',
          description:
            'Sort active work or drag the timeline. Filter by client or status.',
        },
        {
          icon: 'Layers',
          title: 'Phases and deliverables',
          description:
            'Know the stage and what ships next.',
        },
        {
          icon: 'Users',
          title: 'Client context built in',
          description:
            'Messages, portal, and history sit on the same job.',
        },
        {
          icon: 'ArrowRight',
          title: 'Won deals become projects',
          description:
            'Pipeline wins carry brief and contacts — you start delivery, not data entry.',
        },
      ],
      connectedTo: [
        { label: 'Pipeline', href: '/features/pipeline' },
        { label: 'Tasks', href: '/features/tasks' },
        { label: 'Planner', href: '/features/planner' },
        { label: 'Contracts', href: '/features/contracts' },
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Activity', href: '/features/activity' },
      ],
      connectionHeading: 'Projects at the centre',
      connectionDescription:
        'Tasks, meetings, invoices, and portals hang off one project record.',
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
      'One task list across workspaces, linked to real work.',
    indexIcon: 'CheckSquare',
    primaryKeyword: 'task management for freelancers',
  answerFirst:
    'Ozer tasks unify personal and client work in one list, link to projects, feed the planner, and receive items from meetings and email. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on task lists on the Ozer blog',
  },
    metadata: {
      title: 'One task list, full context — Ozer',
      description:
        'Unified tasks across workspaces, linked to clients and projects, feeding today’s planner.',
      keywords: [
        'task management for freelancers',
        'agency task list',
        'unified task manager',
        'client task tracking',
      ],
      canonical: 'https://ozer.so/features/tasks',
      openGraphTitle: 'One task list, full context — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Task Management for Freelancers',
      description:
        'Unified tasks linked to clients, projects, and the daily planner.',
      url: 'https://ozer.so/features/tasks',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Tasks',
      heading: 'One list, full context',
      subheading:
        'Ozer tasks answer “what is open across my life and clients?” One list across workspaces, or filter to one. Tasks link to clients and projects and feed today’s planner.',
      highlights: [
        {
          icon: 'CheckSquare',
          title: 'Cross-workspace list',
          description:
            'Personal and client work in one view — or scoped when you need focus.',
        },
        {
          icon: 'Users',
          title: 'Linked to clients and jobs',
          description:
            'Tasks appear on the project, not as orphans.',
        },
        {
          icon: 'CalendarDays',
          title: 'Powers the planner',
          description:
            'Due work surfaces in today automatically.',
        },
        {
          icon: 'Sparkles',
          title: 'From meetings and email',
          description:
            'Extracted action items land here for review.',
        },
      ],
      connectedTo: [
        { label: 'Planner', href: '/features/planner' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Desktop Assistant', href: '/features/desktop-assistant' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
      ],
      connectionHeading: 'Tasks that know their home',
      connectionDescription:
        'A task on a project updates the project. The planner reads the same list.',
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
      'Send and track contracts on the client and job.',
    indexIcon: 'FileSignature',
    primaryKeyword: 'contract management for freelancers',
  answerFirst:
    'Ozer contracts send agreements for signature and track status on the client and project without a separate e-sign product. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on contracts on the Ozer blog',
  },
    metadata: {
      title: 'Contracts on the job — Ozer',
      description:
        'Send and track client contracts on the client and project — no separate e-sign tool.',
      keywords: [
        'contract management for freelancers',
        'freelance contract software',
        'client contract e-sign',
        'agency contracts',
      ],
      canonical: 'https://ozer.so/features/contracts',
      openGraphTitle: 'Contracts on the job — Ozer',
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
      heading: 'Contracts on the job',
      subheading:
        'Ozer contracts answer “has this been signed?” Draft, send, and track status on the client and project — without a separate e-sign product.',
      highlights: [
        {
          icon: 'FileSignature',
          title: 'Send and collect signatures',
          description:
            'Secure link, clear status: sent, viewed, signed.',
        },
        {
          icon: 'Users',
          title: 'Tied to the client',
          description:
            'Every agreement sits on the relationship record.',
        },
        {
          icon: 'FolderKanban',
          title: 'Linked to projects',
          description:
            'Signed terms sit on the job before work starts.',
        },
        {
          icon: 'CreditCard',
          title: 'Payment milestones optional',
          description:
            'Align totals with how you invoice later.',
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Client Portals', href: '/features/client-portals' },
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Pipeline', href: '/features/pipeline' },
      ],
      connectionHeading: 'Signed terms before delivery',
      connectionDescription:
        'Win the deal, send the contract, start the project — one system.',
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
      'Playbooks your team runs — not PDFs nobody opens.',
    indexIcon: 'ListChecks',
    primaryKeyword: 'SOP software for agencies',
  answerFirst:
    'Ozer SOPs turn processes into playbooks you run as checklists with assignees and history inside the Workspace OS. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on playbooks on the Ozer blog',
  },
    metadata: {
      title: 'Playbooks you actually run — Ozer',
      description:
        'Turn processes into checklists with assignees and history inside the Workspace OS.',
      keywords: [
        'SOP software for agencies',
        'agency playbooks',
        'standard operating procedures',
        'agency checklists',
      ],
      canonical: 'https://ozer.so/features/sops',
      openGraphTitle: 'Playbooks you actually run — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'SOPs & Playbooks for Agencies',
      description:
        'Playbooks run as checklists with assignees and history.',
      url: 'https://ozer.so/features/sops',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer SOPs',
      heading: 'Playbooks you actually run',
      subheading:
        'Ozer SOPs answer “how do we do this the same way every time?” Document a process once, run it as a checklist each month or project, assign steps, and keep history.',
      highlights: [
        {
          icon: 'ListChecks',
          title: 'Playbook library',
          description:
            'Onboarding, monthly close, launch — one place for how you work.',
        },
        {
          icon: 'RefreshCw',
          title: 'Recurring or per project',
          description:
            'Schedule runs or attach a checklist to a kickoff.',
        },
        {
          icon: 'Users',
          title: 'Assignees per step',
          description:
            'Everyone knows what they own.',
        },
        {
          icon: 'Sparkles',
          title: 'Import from existing docs',
          description:
            'Paste a process doc and Ozer structures the steps.',
        },
      ],
      connectedTo: [
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Tasks', href: '/features/tasks' },
        { label: 'Planner', href: '/features/planner' },
        { label: 'Second Brain', href: '/features/second-brain' },
      ],
      connectionHeading: 'Process next to delivery',
      connectionDescription:
        'Playbooks surface in planning and stay searchable — not in a forgotten folder.',
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
      'Leads to projects — win once, never re-enter.',
    indexIcon: 'Kanban',
    primaryKeyword: 'CRM pipeline for freelancers',
  answerFirst:
    'Ozer pipeline tracks leads and proposals. When you win, the deal becomes a project with context intact and no re-entry. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on pipeline on the Ozer blog',
  },
    metadata: {
      title: 'Win once, deliver once — Ozer',
      description:
        'Track leads and proposals; a win becomes a project with context intact — no re-entry.',
      keywords: [
        'CRM pipeline for freelancers',
        'agency CRM software',
        'freelance sales pipeline',
        'lead tracking for freelancers',
        'agency pipeline tool',
      ],
      canonical: 'https://ozer.so/features/pipeline',
      openGraphTitle: 'Win once, deliver once — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'CRM Pipeline for Freelancers',
      description:
        'Track leads and proposals; wins become projects automatically.',
      url: 'https://ozer.so/features/pipeline',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Pipeline',
      heading: 'Win once, deliver once',
      subheading:
        'Ozer pipeline answers “where is this lead?” Track opportunities and proposals. When you win, the deal becomes a project with context intact — no re-entry into a delivery tool.',
      highlights: [
        {
          icon: 'Kanban',
          title: 'Pipeline at a glance',
          description:
            'See what is active, stalled, or needs a nudge.',
        },
        {
          icon: 'FileSignature',
          title: 'Proposal tracking',
          description:
            'Know when a prospect has viewed the proposal.',
        },
        {
          icon: 'ArrowRight',
          title: 'Win becomes a project',
          description:
            'Client, brief, and context carry over in one step.',
        },
        {
          icon: 'Clock',
          title: 'History from first contact',
          description:
            'The relationship record starts when the lead enters.',
        },
      ],
      connectedTo: [
        { label: 'Project Management', href: '/features/project-management' },
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Email Assistant', href: '/features/email-assistant' },
        { label: 'Clients', href: '/features/client-portals' },
      ],
      connectionHeading: 'Where relationships begin',
      connectionDescription:
        'Lead becomes client, client becomes project, project becomes invoice — connected.',
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
      'What you earned, what is owed — optional FreeAgent sync.',
    indexIcon: 'BarChart3',
    primaryKeyword: 'freelance finance management',
  answerFirst:
    'Ozer finances shows revenue, outstanding invoices, and project profitability in pounds, with optional FreeAgent sync for UK books. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK. It is part of the Ozer Workspace OS for freelancers and small agencies in the UK.',
  relatedBlog: {
    href: '/blog',
    label: 'Studio notes on studio finances on the Ozer blog',
  },
    heroBadge: 'FreeAgent sync for UK books',
    metadata: {
      title: 'Money next to the work — Ozer',
      description:
        'Revenue, outstanding invoices, and project profitability in £, with optional FreeAgent sync.',
      keywords: [
        'freelance finance management',
        'agency financial dashboard',
        'FreeAgent integration',
        'freelance accounting tool',
        'income tracker for freelancers',
      ],
      canonical: 'https://ozer.so/features/finances',
      openGraphTitle: 'Money next to the work — Ozer',
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Freelance Finance Management',
      description:
        'Revenue, outstanding invoices, and project profitability with optional FreeAgent sync.',
      url: 'https://ozer.so/features/finances',
      isPartOf: { '@type': 'WebSite', name: 'Ozer', url: 'https://ozer.so' },
    },
    props: {
      eyebrow: 'Ozer Finances',
      heading: 'Money next to the work',
      subheading:
        'Ozer finances answers “what am I owed?” Revenue, outstanding invoices, and project profitability in one view. Optional FreeAgent sync keeps the operational picture aligned with your UK books.',
      highlights: [
        {
          icon: 'BarChart3',
          title: 'Revenue at a glance',
          description:
            'Earned, outstanding, and forecast — without a spreadsheet ritual.',
        },
        {
          icon: 'PieChart',
          title: 'Per-project profitability',
          description:
            'See which clients pay for the time you spend.',
        },
        {
          icon: 'RefreshCw',
          title: 'FreeAgent bank sync',
          description:
            'Import transactions and categories so ops and books stay aligned.',
        },
        {
          icon: 'AlertTriangle',
          title: 'Unpaid invoices surface',
          description:
            'Ozer shows what is overdue so you can chase it.',
        },
      ],
      connectedTo: [
        { label: 'Invoicing', href: '/features/invoicing' },
        { label: 'Projects', href: '/features/project-management' },
        { label: 'Activity', href: '/features/activity' },
        { label: 'Pipeline', href: '/features/pipeline' },
      ],
      connectionHeading: 'Numbers from real work',
      connectionDescription:
        'Every figure traces to a project, client, or invoice — and FreeAgent can feed bank activity in.',
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

  return buildMarketingMetadata({
    title: metadata.title,
    description: metadata.description,
    path: `/features/${slug}`,
    ogType: 'feature',
    keywords: metadata.keywords,
  });
}
