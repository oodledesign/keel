// Task A: Life CRM → OS copy (section title, comparison label, ctaLine).
// Task B: Meeting Assistant benefit card (marketing features grid).
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
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
};

export type InterconnectedWorkspaceNode = {
  id: string;
  label: string;
  color: string;
  examples: string;
};

export const INTERCONNECTED_WORKSPACES_MARKETING = {
  eyebrow: 'Why Ozer is different',
  title: 'One OS.',
  titleAccent: 'Every workspace connected.',
  subtitle:
    'Most CRMs lock work in a silo. Ozer links your personal life, business, family, and community spaces — with Email and Meeting Assistants, AI planner, and a second brain that all connect through one calm home.',
  comparison: {
    heading: 'Not another siloed CRM',
    traditionalLabel: 'Typical CRM',
    keelLabel: 'Ozer',
    traditional: [
      'Work lives in one product; life lives elsewhere',
      'Separate logins, tabs, and mental models',
      'Tasks trapped inside each tool',
      'No shared “today” across work and home',
      'Add-ons bolted on, never truly unified',
    ],
    keel: [
      'Personal home sees tasks across every workspace',
      'One login — flip between spaces instantly',
      'Unified planner, today view, and task list',
      'Custom shortcuts to any page in any workspace',
      'Toggle workspace tasks off when you need focus',
    ],
  },
  hubLabel: 'Your personal home',
  hubCaption: 'Today’s focus · Planner · Tasks · Shortcuts',
  workspaceNodes: [
    {
      id: 'work',
      label: 'Business',
      color: '#2563EB',
      examples: 'Clients, jobs, invoices',
    },
    {
      id: 'family',
      label: 'Family workspace',
      color: '#7C3AED',
      examples: 'Calendar, meals, shopping',
    },
    {
      id: 'community',
      label: 'Community',
      color: '#2A9D8F',
      examples: 'Events, volunteers',
    },
  ] satisfies InterconnectedWorkspaceNode[],
  benefits: [
    {
      icon: ListTodo,
      title: 'All tasks, one list',
      description:
        'See everything due today across personal life and every workspace — filter by space when you want, or keep the full picture.',
    },
    {
      icon: Mic,
      title: 'Meeting Assistant',
      description:
        'Available at launch on Mac. Record any call or in-person meeting, transcribe with speaker labels, extract tasks, and sync everything to the right workspace — locally, with no per-minute fees.',
    },
    {
      icon: Sparkles,
      title: 'Planner & today view',
      description:
        'AI day planning pulls from all your open tasks and calendar. Today view shows your schedule and due items without clutter.',
    },
    {
      icon: LayoutDashboard,
      title: 'Shortcuts anywhere',
      description:
        'Pin Rankly, invoices, family calendar, or any page from any workspace to your personal home and mobile bar.',
    },
    {
      icon: Layers,
      title: 'Workspace overview',
      description:
        'Glance at open tasks and next events per workspace from personal home — then jump straight in.',
    },
    {
      icon: CalendarDays,
      title: 'Shared calendar context',
      description:
        'Meetings from work and family events surface together when you plan your day — not buried in separate apps.',
    },
    {
      icon: Smartphone,
      title: 'Mobile, still connected',
      description:
        'Custom bottom-nav shortcuts reach into any workspace from your phone — Home, Menu, and up to three pins you choose.',
    },
  ] satisfies InterconnectedBenefit[],
  ctaLine:
    'Agency work, family, and personal life — all in one account.',
} as const;

export const INTERCONNECTED_PERSONAL_HOOK =
  'Your free personal home is the hub — business, family, and community workspaces plug in without losing the big picture.';

export const INTERCONNECTED_WORK_HOOK =
  'Run your business workspace inside the same Ozer account as your personal life — tasks and plans stay connected, not copied between apps.';
