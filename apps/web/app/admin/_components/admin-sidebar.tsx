'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  ArrowLeft,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Mail,
  Palette,
  PiggyBank,
  ScrollText,
  Users,
} from 'lucide-react';

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
  SidebarTrigger,
} from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import pathsConfig from '~/config/paths.config';

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
                isActive={
                  path.includes('/admin/billing') &&
                  !path.includes('/admin/billing/at-risk')
                }
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/billing'}>
                  <CreditCard className={'h-4'} />
                  <span>Billing</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/finances')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/finances'}>
                  <PiggyBank className={'h-4'} />
                  <span>Finances</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/billing/at-risk')}
                asChild
              >
                <Link
                  className={'flex gap-2.5'}
                  href={'/admin/billing/at-risk'}
                >
                  <LifeBuoy className={'h-4'} />
                  <span>At-risk</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/branding')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/branding'}>
                  <Palette className={'h-4'} />
                  <span>Branding</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                isActive={path.includes('/admin/blog')}
                asChild
              >
                <Link className={'flex gap-2.5'} href={'/admin/blog'}>
                  <FileText className={'h-4'} />
                  <span>Blog</span>
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
                <Link
                  className={'flex gap-2.5'}
                  href={'/admin/email-marketing'}
                >
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

      <SidebarFooter className="gap-2">
        <SidebarMenu>
          <SidebarMenuButton asChild tooltip="Back to app">
            <Link className="flex gap-2.5" href={pathsConfig.app.home}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back to app</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenu>

        <div className="flex justify-center px-2">
          <SidebarTrigger className="border-border text-muted-foreground hover:bg-muted hover:text-foreground h-8 w-8 rounded-md border" />
        </div>

        <ProfileAccountDropdownContainer />
      </SidebarFooter>
    </Sidebar>
  );
}
