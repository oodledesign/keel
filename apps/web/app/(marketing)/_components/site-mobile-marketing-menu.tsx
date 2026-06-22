'use client';

import Link from 'next/link';

import {
  CreditCard,
  LayoutGrid,
  Layers,
  LayoutTemplate,
  LogIn,
  Menu,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';
import { Trans } from '@kit/ui/trans';

import { getMarketingAppNavLinks } from '~/lib/marketing/app-landing-pages';
import { FEATURE_NAV_GROUPS } from '~/lib/marketing/feature-landing-pages';
import { getMarketingWorkspaceNavLinks } from '~/lib/marketing/segment-landing-pages';
import pathsConfig from '~/config/paths.config';

import {
  marketingNavPanelClass,
  marketingNavScrollClass,
  marketingNavSubContentClass,
} from './site-marketing-nav-styles';

const workspaceNavLinks = getMarketingWorkspaceNavLinks();
const appNavLinks = getMarketingAppNavLinks();

const mobileSubContentProps = {
  side: 'bottom' as const,
  align: 'end' as const,
  collisionPadding: 16,
};

export function SiteMobileMarketingMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open Menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-200/20 bg-violet-500/10 text-violet-100 transition-colors hover:bg-violet-500/20"
      >
        <Menu className="h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        collisionPadding={16}
        className={cn(
          'w-[min(100vw-1.5rem,20rem)] p-2',
          marketingNavPanelClass,
          marketingNavScrollClass,
        )}
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex h-12 items-center gap-3 rounded-md px-3 text-base text-violet-100/90 focus:bg-violet-500/15 focus:text-violet-50">
            <LayoutTemplate className="h-5 w-5 shrink-0 opacity-80" />
            Workspaces
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            {...mobileSubContentProps}
            className={marketingNavSubContentClass}
          >
            {workspaceNavLinks.map((item) => {
              const Icon = item.icon;

              return (
                <DropdownMenuItem key={item.path} asChild>
                  <Link
                    className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-violet-100/85 hover:bg-violet-500/15 hover:text-violet-50"
                    href={item.path}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem asChild>
          <Link
            className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-base text-violet-100/90 transition-colors hover:bg-violet-500/15 hover:text-violet-50"
            href="/pricing"
          >
            <CreditCard className="h-5 w-5 shrink-0 opacity-80" />
            <Trans i18nKey="marketing:pricing" />
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-violet-200/15" />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex h-12 items-center gap-3 rounded-md px-3 text-base text-violet-100/90 focus:bg-violet-500/15 focus:text-violet-50">
            <Layers className="h-5 w-5 shrink-0 opacity-80" />
            Features
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            {...mobileSubContentProps}
            className={cn(
              marketingNavSubContentClass,
              'w-[min(100vw-1.5rem,18rem)]',
            )}
          >
            <DropdownMenuItem asChild>
              <Link
                className="flex h-11 w-full items-center rounded-md px-3 text-sm font-medium text-violet-100/90 hover:bg-violet-500/15 hover:text-violet-50"
                href="/features"
              >
                All features
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-violet-200/15" />
            {FEATURE_NAV_GROUPS.map((group) => (
              <DropdownMenuSub key={group.label}>
                <DropdownMenuSubTrigger className="rounded-md px-3 text-sm text-violet-100/90 focus:bg-violet-500/15 focus:text-violet-50">
                  {group.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  {...mobileSubContentProps}
                  className={marketingNavSubContentClass}
                >
                  {group.items.map((item) => (
                    <DropdownMenuItem
                      key={`${group.label}-${item.href}-${item.label}`}
                      asChild
                    >
                      <Link
                        className="flex h-11 w-full items-center rounded-md px-3 text-sm text-violet-100/85 hover:bg-violet-500/15 hover:text-violet-50"
                        href={item.href}
                      >
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex h-12 items-center gap-3 rounded-md px-3 text-base text-violet-100/90 focus:bg-violet-500/15 focus:text-violet-50">
            <LayoutGrid className="h-5 w-5 shrink-0 opacity-80" />
            Apps
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            {...mobileSubContentProps}
            className={marketingNavSubContentClass}
          >
            <DropdownMenuItem asChild>
              <Link
                className="flex h-11 w-full items-center rounded-md px-3 text-sm font-medium text-violet-100/90 hover:bg-violet-500/15 hover:text-violet-50"
                href="/apps"
              >
                All Ozer apps
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-violet-200/15" />
            {appNavLinks.map((item) => (
              <DropdownMenuItem key={item.path} asChild>
                <Link
                  className="flex h-11 w-full items-center rounded-md px-3 text-sm text-violet-100/85 hover:bg-violet-500/15 hover:text-violet-50"
                  href={item.path}
                >
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-violet-200/15" />

        <DropdownMenuItem asChild>
          <Link
            className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-base font-medium text-violet-100/90 hover:bg-violet-500/15 hover:text-violet-50"
            href={pathsConfig.auth.signIn}
          >
            <LogIn className="h-5 w-5 shrink-0 opacity-80" />
            <Trans i18nKey="auth:signIn" defaults="Log in" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
