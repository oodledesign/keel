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

import type { PersonalNavWorkspace } from '~/config/personal-account-navigation.config';

import { workspaceAccentColor, workspaceColorForSpaceType } from '../_lib/workspace-accent';

export function PersonalWorkspaceNav(props: {
  workspaces: PersonalNavWorkspace[];
}) {
  const pathname = usePathname() ?? '';

  if (props.workspaces.length === 0) {
    return null;
  }

  return (
    <SidebarMenu className="mt-2 gap-0.5">
      {props.workspaces.map((ws) => {
        const href = pathsConfig.app.accountHome.replace('[account]', ws.slug);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const initial = (ws.label.trim()[0] ?? '?').toUpperCase();
        const color = ws.spaceType
          ? workspaceColorForSpaceType(ws.spaceType)
          : workspaceAccentColor(ws.slug);

        return (
          <SidebarMenuItem key={ws.id}>
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={ws.label}
              className="h-10"
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
                <span className="truncate">{ws.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
