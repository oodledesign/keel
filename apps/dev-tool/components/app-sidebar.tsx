'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  BoltIcon,
  ComponentIcon,
  DatabaseIcon,
  FileTextIcon,
  LanguagesIcon,
  LayoutDashboardIcon,
  MailIcon,
} from 'lucide-react';

import {
  Sidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@kit/ui/shadcn-sidebar';
import { isRouteActive } from '@kit/ui/utils';

const routes = [
  {
    label: 'Dashboard',
    path: '/',
    Icon: LayoutDashboardIcon,
  },
  {
    label: 'Environment Variables',
    path: '/variables',
    Icon: BoltIcon,
  },
  {
    label: 'Components',
    path: '/components',
    Icon: ComponentIcon,
  },
  {
    label: 'Emails',
    path: '/emails',
    Icon: MailIcon,
  },
  {
    label: 'Translations',
    path: '/translations',
    Icon: LanguagesIcon,
  },
  {
    label: 'Database',
    path: '/database',
    Icon: DatabaseIcon,
  },
  {
    label: 'PRD Manager',
    path: '/prds',
    Icon: FileTextIcon,
  },
];

export function DevToolSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <b className="p-1 font-mono text-xs font-semibold">Makerkit Dev Tool</b>
      </SidebarHeader>

      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Dev Tools</SidebarGroupLabel>

        <SidebarMenu>
          {routes.map((route) => (
            <SidebarMenuItem key={route.path || route.label}>
              {'children' in route ? (
                <>
                  <SidebarMenuButton>
                    <route.Icon className="h-4 w-4" />
                    <span>{route.label}</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {route.children.map((child) => (
                      <SidebarMenuSubItem key={child.path}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isRouteActive(child.path, pathname, false)}
                        >
                          <Link href={child.path}>
                            <child.Icon className="h-4 w-4" />
                            <span>{child.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </>
              ) : (
                <SidebarMenuButton
                  isActive={isRouteActive(route.path, pathname, false)}
                  asChild
                >
                  <Link href={route.path}>
                    <route.Icon className="h-4 w-4" />
                    <span>{route.label}</span>
                  </Link>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </Sidebar>
  );
}
