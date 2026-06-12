import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  Layers,
  LayoutDashboard,
  ListTodo,
  Smartphone,
  Sparkles,
} from 'lucide-react';

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
  eyebrow: 'Why Keel is different',
  title: 'One Life CRM.',
  titleAccent: 'Every workspace connected.',
  subtitle:
    'Most CRMs lock work in a silo. Keel links your personal life, business, family, property, and community spaces — so tasks, plans, and shortcuts flow through one calm home, not five disconnected apps.',
  comparison: {
    heading: 'Not another siloed CRM',
    traditionalLabel: 'Typical CRM',
    keelLabel: 'Keel Life CRM',
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
      label: 'Family',
      color: '#7C3AED',
      examples: 'Calendar, meals, shopping',
    },
    {
      id: 'property',
      label: 'Property',
      color: '#D97706',
      examples: 'Tenants, maintenance',
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
    'Life and work in one account — the way real people actually live.',
} as const;

export const INTERCONNECTED_PERSONAL_HOOK =
  'Your free personal home is the hub — business, family, and community workspaces plug in without losing the big picture.';

export const INTERCONNECTED_WORK_HOOK =
  'Run your business workspace inside the same Keel account as your personal life — tasks and plans stay connected, not copied between apps.';
