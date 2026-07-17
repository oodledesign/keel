// Task A: Life CRM → OS copy (section title, comparison label, ctaLine).
// Task B: Meeting Assistant benefit card (marketing features grid).
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  CalendarDays,
  Keyboard,
  Layers,
  LayoutDashboard,
  ListTodo,
  Mail,
  Mic,
  Smartphone,
  Sparkles,
} from 'lucide-react';

export type PersonalAssistantBilling = 'addon' | 'included';

export type PersonalAssistantMarketing = {
  id: 'email' | 'meeting' | 'planner';
  label: string;
  description: string;
  icon: LucideIcon;
  billing: PersonalAssistantBilling;
  addonTooltip: string;
};

/** Personal-home assistant layer — shared by orbit diagram and marketing copy. */
export const PERSONAL_ASSISTANTS_MARKETING: PersonalAssistantMarketing[] = [
  {
    id: 'email',
    label: 'Email Assistant',
    description:
      'Gmail sync, AI action items, and draft replies in your personal home',
    icon: Mail,
    billing: 'addon',
    addonTooltip: 'Email Assistant — £9/mo personal add-on',
  },
  {
    id: 'meeting',
    label: 'Meeting Assistant',
    description:
      'Record, transcribe, and extract tasks from meetings — synced to the right workspace',
    icon: Mic,
    billing: 'addon',
    addonTooltip: 'Meeting Assistant — personal add-on, available at launch',
  },
  {
    id: 'planner',
    label: 'AI Planner',
    description:
      'Today view, day planning, and priorities pulled from every workspace',
    icon: Sparkles,
    billing: 'included',
    addonTooltip: 'AI Planner included with your personal home',
  },
];

export type InterconnectedBenefit = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
};

export type InterconnectedWorkspaceNode = {
  id: string;
  label: string;
  color: string;
  examples: string;
};

export const INTERCONNECTED_WORKSPACES_MARKETING = {
  eyebrow: 'Why Ozer is different',
  title: 'One Workspace OS.',
  titleAccent: 'Every space connected.',
  subtitle:
    'A small studio should not need seven tools and Zapier. Ozer links studio work, personal life, and family workspaces — with assistants and a planner that share one home.',
  comparison: {
    heading: 'Not another siloed CRM',
    traditionalLabel: 'Typical stack',
    ozerLabel: 'Ozer',
    traditional: [
      'Work in one product; life in three others',
      'Separate logins and mental models',
      'Tasks trapped inside each tool',
      'No shared “today” across work and home',
      'Add-ons bolted on, never truly joined',
    ],
    ozer: [
      'Personal home sees tasks across every workspace',
      'One login — switch spaces without context loss',
      'One planner, today view, and task list',
      'Activity on your Mac — assigned to clients and projects',
      'Shortcuts to any page in any workspace',
      'Turn workspace tasks off when you need focus',
    ],
  },
  hubLabel: 'Your personal home',
  hubCaption: 'Today · Planner · Tasks · Activity · Shortcuts',
  workspaceNodes: [
    {
      id: 'work',
      label: 'Business',
      color: 'var(--ozer-sky-100)',
      examples: 'Clients, jobs, invoices',
    },
    {
      id: 'family',
      label: 'Family workspace',
      color: 'var(--ozer-sage-500)',
      examples: 'Calendar, meals, shopping',
    },
  ] satisfies InterconnectedWorkspaceNode[],
  benefits: [
    {
      icon: ListTodo,
      title: 'All tasks, one list',
      description:
        'See what is due today across personal life and every workspace — filter by space when you need focus.',
    },
    {
      icon: Mic,
      title: 'Meeting Assistant for Mac',
      description:
        'Record any call or room meeting, label speakers, extract tasks, and sync to the right workspace. Audio is processed on your Mac — not kept as a permanent recording.',
      href: '/features/desktop-assistant',
    },
    {
      icon: Keyboard,
      title: 'Dictation',
      description:
        'Press fn on your Mac and speak into any app. Punctuated text, included in the same Assistant download.',
      href: '/features/dictation',
    },
    {
      icon: Activity,
      title: 'Activity tracking',
      description:
        'Ozer Assistant captures app and website sessions on your Mac — assign time to clients and projects from one activity view.',
      href: '/features/activity',
    },
    {
      icon: Sparkles,
      title: 'Planner and today',
      description:
        'Today pulls open tasks and calendar from every space you belong to.',
    },
    {
      icon: LayoutDashboard,
      title: 'Shortcuts anywhere',
      description:
        'Pin invoices, a client, or the family calendar to your personal home and phone bar.',
    },
    {
      icon: Layers,
      title: 'Workspace overview',
      description:
        'Open tasks and next events per workspace from personal home — then jump in.',
    },
    {
      icon: CalendarDays,
      title: 'Shared calendar context',
      description:
        'Work meetings and family events surface together when you plan the day.',
    },
    {
      icon: Smartphone,
      title: 'Mobile, still connected',
      description:
        'Home, Menu, and up to three pins reach any workspace from your phone.',
    },
  ] satisfies InterconnectedBenefit[],
  ctaLine: 'Studio work, family, and personal life — one account.',
} as const;

export const INTERCONNECTED_PERSONAL_HOOK =
  'Your free personal home is the hub — business and family workspaces connect without losing the picture.';

export const INTERCONNECTED_WORK_HOOK =
  'Run your business workspace inside the same Ozer account as your personal life — tasks and plans stay connected, not copied between apps.';
