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
import { marketingNavDropdownItem } from '~/lib/marketing/marketing-ui';

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
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/70 text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-panel-hover)]"
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
          <DropdownMenuSubTrigger className={cn('flex h-12 items-center gap-3 rounded-md px-3 text-base', marketingNavDropdownItem)}>
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
                    className={cn('flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm', marketingNavDropdownItem)}
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
            className={cn('flex h-12 w-full items-center gap-3 rounded-md px-3 text-base transition-colors', marketingNavDropdownItem)}
            href="/pricing"
          >
            <CreditCard className="h-5 w-5 shrink-0 opacity-80" />
            <Trans i18nKey="marketing:pricing" />
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-[color:var(--workspace-shell-border)]" />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={cn('flex h-12 items-center gap-3 rounded-md px-3 text-base', marketingNavDropdownItem)}>
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
                className={cn('flex h-11 w-full items-center rounded-md px-3 text-sm font-medium', marketingNavDropdownItem)}
                href="/features"
              >
                All features
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[color:var(--workspace-shell-border)]" />
            {FEATURE_NAV_GROUPS.map((group) => (
              <DropdownMenuSub key={group.label}>
                <DropdownMenuSubTrigger className={cn('rounded-md px-3 text-sm', marketingNavDropdownItem)}>
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
                        className={cn('flex h-11 w-full items-center rounded-md px-3 text-sm', marketingNavDropdownItem)}
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
          <DropdownMenuSubTrigger className={cn('flex h-12 items-center gap-3 rounded-md px-3 text-base', marketingNavDropdownItem)}>
            <LayoutGrid className="h-5 w-5 shrink-0 opacity-80" />
            Apps
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            {...mobileSubContentProps}
            className={marketingNavSubContentClass}
          >
            <DropdownMenuItem asChild>
              <Link
                className={cn('flex h-11 w-full items-center rounded-md px-3 text-sm font-medium', marketingNavDropdownItem)}
                href="/apps"
              >
                All Ozer apps
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[color:var(--workspace-shell-border)]" />
            {appNavLinks.map((item) => (
              <DropdownMenuItem key={item.path} asChild>
                <Link
                  className={cn('flex h-11 w-full items-center rounded-md px-3 text-sm', marketingNavDropdownItem)}
                  href={item.path}
                >
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-[color:var(--workspace-shell-border)]" />

        <DropdownMenuItem asChild>
          <Link
            className={cn('flex h-12 w-full items-center gap-3 rounded-md px-3 text-base font-medium', marketingNavDropdownItem)}
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
