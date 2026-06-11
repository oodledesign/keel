'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CreditCard, Inbox, LayoutDashboard, LayoutGrid, LifeBuoy, Mail, ScrollText, Users } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
} from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';

export function AdminSidebar() {
  const path = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={'m-2'}>
        <AppLogo href={'/admin'} className="max-w-full" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Super Admin</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuButton isActive={path === '/admin'} asChild>
                <Link className={'flex gap-2.5'} href={'/admin'}>
                  <LayoutDashboard className={'h-4'} />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/users')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/users'}>
                  <Users className={'h-4'} />
                  <span>Users</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/workspaces')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/workspaces'}>
                  <LayoutGrid className={'h-4'} />
                  <span>Workspaces</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/billing')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/billing'}>
                  <CreditCard className={'h-4'} />
                  <span>Billing</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={
                  path.includes('/admin/accounts') &&
                  !path.match(/\/admin\/accounts\/[^/]+/)
                }
                asChild
              >
                <Link
                  className={'flex size-full gap-2.5'}
                  href={'/admin/accounts'}
                >
                  <Users className={'h-4'} />
                  <span>Accounts</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/support')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/support'}>
                  <LifeBuoy className={'h-4'} />
                  <span>Support</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/email-marketing')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/email-marketing'}>
                  <Mail className={'h-4'} />
                  <span>Email marketing</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/email-log')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/email-log'}>
                  <Inbox className={'h-4'} />
                  <span>Email log</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/audit')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/audit'}>
                  <ScrollText className={'h-4'} />
                  <span>Audit log</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <ProfileAccountDropdownContainer />
      </SidebarFooter>
    </Sidebar>
  );
}
