'use client';

import {
  BarChart3,
  Briefcase,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileSignature,
  FileText,
  Globe,
  Home,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  Mail,
  MessageSquare,
  MessageSquareText,
  Mic,
  PenLine,
  Share2,
  Sparkles,
  StickyNote,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  coerceMobileNavIconKey,
  type MobileNavIconKey,
} from '~/lib/mobile-nav/nav-icon-keys';

const ICON_BY_KEY: Record<MobileNavIconKey, LucideIcon> = {
  home: Home,
  tasks: CheckSquare,
  pipeline: Kanban,
  email: Mail,
  planner: CalendarDays,
  today: CalendarClock,
  people: Users,
  jobs: ClipboardList,
  schedule: Calendar,
  clients: Briefcase,
  meetings: Mic,
  websites: Globe,
  support: LifeBuoy,
  invoices: FileText,
  proposals: PenLine,
  contracts: FileSignature,
  notes: StickyNote,
  brain: Sparkles,
  sops: ListChecks,
  messages: MessageSquare,
  finances: Wallet,
  videos: LayoutGrid,
  rankly: BarChart3,
  signatures: PenLine,
  feedflow: Share2,
  reviews: MessageSquareText,
  social: Share2,
  apps: LayoutGrid,
  properties: Briefcase,
  calendar: Calendar,
  shopping: LayoutGrid,
  meal: CalendarDays,
  workspace: LayoutDashboard,
};

type MobileNavTabIconProps = {
  iconKey: MobileNavIconKey;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarFallback?: string;
  className?: string;
};

export function MobileNavTabIcon({
  iconKey,
  avatarUrl,
  avatarColor,
  avatarFallback,
  className,
}: MobileNavTabIconProps) {
  const resolvedKey = coerceMobileNavIconKey(iconKey) ?? 'workspace';

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn('h-[21px] w-[21px] rounded-full object-cover', className)}
      />
    );
  }

  if (avatarFallback && resolvedKey === 'workspace') {
    return (
      <span
        className={cn(
          'flex h-[21px] w-[21px] items-center justify-center rounded-full text-[10px] font-semibold text-[var(--workspace-shell-text)]',
          className,
        )}
        style={{ backgroundColor: avatarColor ?? '#334155' }}
      >
        {avatarFallback}
      </span>
    );
  }

  const Icon = ICON_BY_KEY[resolvedKey];
  return <Icon className={cn('h-[21px] w-[21px]', className)} />;
}
