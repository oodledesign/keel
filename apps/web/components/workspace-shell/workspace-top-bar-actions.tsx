'use client';

import { type ReactNode, useMemo } from 'react';

import Link from 'next/link';

import { CalendarDays, Mail } from 'lucide-react';

import { NotificationsPopover } from '@kit/notifications/components';
import type { JWTUserData } from '@kit/supabase/types';
import { Button } from '@kit/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';

import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { PersonalVisionTopBarIcon } from '~/components/personal-vision/personal-vision-top-bar-icon';
import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';
import { toHomeBillingHref } from '~/lib/ai/billing-href';

import { WorkspaceNewMenu } from './workspace-new-menu';
import { WorkspaceOooTopBarIcon } from './workspace-ooo-top-bar-icon';
import { WorkspaceSearchButton } from './workspace-search-button';

type WorkspaceTopBarBaseProps = {
  userId: string;
  user?: JWTUserData | null;
  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };
  showNewMenu?: boolean;
};

function TopBarIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
        >
          <Link href={href} aria-label={label}>
            {children}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function WorkspaceMobileTopActions(
  props:
    | ({
        variant: 'team';
        accountId: string;
        accountSlug: string;
        spaceType?: WorkspaceSpaceType;
      } & WorkspaceTopBarBaseProps)
    | ({
        variant: 'personal';
        accountId?: string;
      } & WorkspaceTopBarBaseProps),
) {
  const notificationAccountIds = useMemo(
    () =>
      [props.userId, props.accountId].filter((id): id is string => Boolean(id)),
    [props.accountId, props.userId],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex shrink-0 items-center gap-1">
        <PersonalVisionTopBarIcon />
        <WorkspaceOooTopBarIcon accountId={props.accountId} />
        <WorkspaceSearchButton iconOnly />
        {featureFlagsConfig.enableNotifications ? (
          <NotificationsPopover
            accountIds={notificationAccountIds}
            realtime={featureFlagsConfig.realtimeNotifications}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

export function WorkspaceDesktopTopBar(
  props:
    | ({
        variant: 'team';
        accountId: string;
        accountSlug: string;
        spaceType?: WorkspaceSpaceType;
      } & WorkspaceTopBarBaseProps)
    | ({
        variant: 'personal';
        accountId?: string;
      } & WorkspaceTopBarBaseProps),
) {
  const showNew = props.showNewMenu ?? true;
  const notificationAccountIds = useMemo(
    () =>
      [props.userId, props.accountId].filter((id): id is string => Boolean(id)),
    [props.accountId, props.userId],
  );

  const emailHref =
    props.variant === 'team'
      ? pathsConfig.app.accountEmailAssistant.replace(
          '[account]',
          props.accountSlug,
        )
      : pathsConfig.app.personalEmailAssistant;

  const plannerHref =
    props.variant === 'team'
      ? pathsConfig.app.accountPlannerDay.replace(
          '[account]',
          props.accountSlug,
        )
      : pathsConfig.app.personalPlannerDay;

  return (
    <header className="sticky top-0 z-30 hidden h-14 shrink-0 items-center justify-end gap-2 border-0 bg-transparent px-4 lg:flex lg:px-6">
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-1.5">
          <PersonalVisionTopBarIcon />
          <WorkspaceOooTopBarIcon accountId={props.accountId} />
          <WorkspaceSearchButton iconOnly />

          {featureFlagsConfig.enableNotifications ? (
            <NotificationsPopover
              accountIds={notificationAccountIds}
              realtime={featureFlagsConfig.realtimeNotifications}
            />
          ) : null}

          <TopBarIconLink href={emailHref} label="Email">
            <Mail className="h-4 w-4" />
          </TopBarIconLink>

          <TopBarIconLink href={plannerHref} label="Today plan">
            <CalendarDays className="h-4 w-4" />
          </TopBarIconLink>

          {showNew ? (
            props.variant === 'team' ? (
              <WorkspaceNewMenu
                variant="team"
                account={props.accountSlug}
                spaceType={props.spaceType}
              />
            ) : (
              <WorkspaceNewMenu variant="personal" />
            )
          ) : null}

          {props.user ? (
            <div data-tour="profile-menu" className="shrink-0">
              <ProfileAccountDropdownContainer
                user={props.user}
                account={props.account}
                showProfileName={false}
                className="shrink-0"
                billingAccountId={
                  props.variant === 'team' ? props.accountId : props.userId
                }
                billingHref={
                  props.variant === 'team'
                    ? toHomeBillingHref(
                        pathsConfig.app.accountBilling,
                        props.accountSlug,
                      )
                    : toHomeBillingHref(pathsConfig.app.personalAccountBilling)
                }
              />
            </div>
          ) : null}
        </div>
      </TooltipProvider>
    </header>
  );
}
