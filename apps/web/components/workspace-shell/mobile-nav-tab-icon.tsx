'use client';

import {
  BarChart3,
  Briefcase,
  Building2,
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
  LifeBuoy,
  ListChecks,
  type LucideIcon,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareText,
  Mic,
  PenLine,
  Puzzle,
  ScrollText,
  Share2,
  ShoppingCart,
  Sparkles,
  StickyNote,
  Users,
  Video,
  Wallet,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  type MobileNavIconKey,
  coerceMobileNavIconKey,
  resolveMobileNavIconKey,
  resolveNavIconKey,
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
  proposals: ScrollText,
  contracts: FileSignature,
  notes: StickyNote,
  brain: Sparkles,
  sops: ListChecks,
  messages: MessageSquare,
  finances: Wallet,
  videos: Video,
  rankly: BarChart3,
  signatures: PenLine,
  feedflow: Megaphone,
  reviews: MessageSquareText,
  social: Share2,
  apps: Puzzle,
  properties: Building2,
  calendar: Calendar,
  shopping: ShoppingCart,
  meal: CalendarDays,
  workspace: LayoutDashboard,
};

type MobileNavTabIconProps = {
  iconKey: MobileNavIconKey;
  href?: string;
  homePath?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarFallback?: string;
  active?: boolean;
  className?: string;
};

export function MobileNavTabIcon({
  iconKey,
  href,
  homePath,
  avatarUrl,
  avatarColor,
  avatarFallback,
  active = false,
  className,
}: MobileNavTabIconProps) {
  const storedKey = coerceMobileNavIconKey(iconKey);
  const pathKey = href != null ? resolveNavIconKey(href) : null;
  const resolvedKey =
    storedKey && storedKey !== 'workspace'
      ? storedKey
      : pathKey && pathKey !== 'workspace'
        ? pathKey
        : href != null
          ? resolveMobileNavIconKey(href, { homePath, preferredKey: iconKey })
          : (storedKey ?? 'workspace');

  if (avatarUrl && resolvedKey === 'workspace') {
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
          'flex h-[21px] w-[21px] items-center justify-center rounded-full text-[10px] font-semibold',
          active ? 'text-current' : 'text-[var(--workspace-shell-text)]',
          className,
        )}
        style={{ backgroundColor: avatarColor ?? '#334155' }}
      >
        {avatarFallback}
      </span>
    );
  }

  const Icon = ICON_BY_KEY[resolvedKey];
  return (
    <Icon
      className={cn(
        'h-[21px] w-[21px]',
        active ? 'text-current' : 'text-[var(--ozer-accent)]',
        className,
      )}
    />
  );
}
