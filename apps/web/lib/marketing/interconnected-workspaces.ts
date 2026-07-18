// Task A: Life CRM → OS copy (section title, bento framing, ctaLine).
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

export type InterconnectedBentoVisual =
  | 'tasks'
  | 'team'
  | 'spark'
  | 'activity'
  | 'support'
  | 'none';

export type InterconnectedBentoTile = {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  href?: string;
  /** Grid placement hints for the bento layout */
  span: 'sm' | 'md' | 'lg' | 'cta';
  variant: 'cream' | 'accent' | 'visual';
  visual?: InterconnectedBentoVisual;
  ctaLabel?: string;
};

export const INTERCONNECTED_WORKSPACES_MARKETING = {
  eyebrow: 'Why Ozer is different',
  title: 'One Workspace OS.',
  titleAccent: 'Every space connected.',
  subtitle:
    'A small studio should not need seven tools and Zapier. Ozer links studio work, personal life, and family workspaces — with assistants and a planner that share one home.',
  bentoHeading: 'Not another siloed CRM',
  bentoSubheading:
    'One login, one today view, and workspaces that stay connected — without the comparison chart.',
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
  bentoTiles: [
    {
      id: 'tasks',
      title: 'All tasks, one list',
      description:
        'See what is due today across personal life and every workspace — filter by space when you need focus.',
      icon: ListTodo,
      span: 'md',
      variant: 'visual',
      visual: 'tasks',
    },
    {
      id: 'spaces',
      title: 'One login, every space',
      description:
        'Switch between business, family, and personal without losing context — same account, same mental model.',
      icon: Layers,
      span: 'sm',
      variant: 'cream',
      visual: 'team',
    },
    {
      id: 'cta',
      title: 'Start free — personal home included',
      description:
        'Your free hub already sees tasks and today across every workspace you join.',
      span: 'cta',
      variant: 'accent',
      visual: 'none',
      ctaLabel: 'Start free',
      href: '/start',
    },
    {
      id: 'meeting',
      title: 'Meeting Assistant for Mac',
      description:
        'Record any call, label speakers, extract tasks, and sync to the right workspace. Audio stays on your Mac.',
      icon: Mic,
      href: '/features/desktop-assistant',
      span: 'md',
      variant: 'cream',
      visual: 'support',
    },
    {
      id: 'spark',
      title: 'Planner and today',
      description:
        'Today pulls open tasks and calendar from every space you belong to.',
      icon: Sparkles,
      span: 'sm',
      variant: 'visual',
      visual: 'spark',
    },
    {
      id: 'activity',
      title: 'Activity on your Mac',
      description:
        'Capture app and website sessions — assign time to clients and projects from one view.',
      icon: Activity,
      href: '/features/activity',
      span: 'lg',
      variant: 'visual',
      visual: 'activity',
    },
    {
      id: 'shortcuts',
      title: 'Shortcuts anywhere',
      description:
        'Pin invoices, a client, or the family calendar to your personal home and phone bar.',
      icon: LayoutDashboard,
      span: 'sm',
      variant: 'cream',
      visual: 'none',
    },
    {
      id: 'dictation',
      title: 'Dictation',
      description:
        'Press fn on your Mac and speak into any app. Punctuated text, included with Assistant.',
      icon: Keyboard,
      href: '/features/dictation',
      span: 'sm',
      variant: 'cream',
      visual: 'none',
    },
    {
      id: 'mobile',
      title: 'Mobile, still connected',
      description:
        'Home, Menu, and up to three pins reach any workspace from your phone.',
      icon: Smartphone,
      span: 'sm',
      variant: 'cream',
      visual: 'none',
    },
  ] satisfies InterconnectedBentoTile[],
  /** Kept for segment pages / orbit captions that still reference benefit cards. */
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
