'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@kit/ui/shadcn-sidebar';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { FocusStatusBadge } from '~/home/[account]/settings/focus/_components/FocusStatusBadge';
import {
  getWorkspaceFocusMutedClassName,
  WorkspaceFocusSidebarDecorations,
} from '~/components/workspace-shell/workspace-focus-sidebar-decorations';
import { useWorkspaceFocusSettings } from '~/components/workspace-shell/workspace-focus-context';
import { useWorkspaceFocusSnapshot } from '~/lib/hooks/use-workspace-focus';

import type { PersonalNavWorkspace } from '~/config/personal-account-navigation.config';

import { workspaceAccentColor, workspaceColorForSpaceType } from '../_lib/workspace-accent';

function PersonalWorkspaceNavItem({ ws }: { ws: PersonalNavWorkspace }) {
  const pathname = usePathname() ?? '';
  const href = pathsConfig.app.accountHome.replace('[account]', ws.slug);
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const initial = (ws.label.trim()[0] ?? '?').toUpperCase();
  const color = ws.spaceType
    ? workspaceColorForSpaceType(ws.spaceType)
    : workspaceAccentColor(ws.slug);
  const focusSettings = useWorkspaceFocusSettings(ws.id);
  const focusState = useWorkspaceFocusSnapshot(focusSettings);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={ws.label}
        className={cn('h-auto min-h-10 py-2', getWorkspaceFocusMutedClassName(focusSettings))}
      >
        <Link href={href}>
          <Avatar className={cn('h-6 w-6 rounded-md', 'shrink-0')}>
            <AvatarImage src={ws.pictureUrl ?? undefined} alt="" />
            <AvatarFallback
              className="rounded-md text-[11px] font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate">{ws.label}</span>
              {focusState.isWorkspaceSilenced ? (
                <FocusStatusBadge settings={focusSettings} compact />
              ) : null}
            </span>
            <WorkspaceFocusSidebarDecorations
              accountId={ws.id}
              settings={focusSettings}
              className="mt-0.5"
              hideSilencedBadge
            />
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function PersonalWorkspaceNav(props: {
  workspaces: PersonalNavWorkspace[];
}) {
  if (props.workspaces.length === 0) {
    return null;
  }

  return (
    <SidebarMenu className="mt-2 gap-0.5">
      {props.workspaces.map((ws) => (
        <PersonalWorkspaceNavItem key={ws.id} ws={ws} />
      ))}
    </SidebarMenu>
  );
}
