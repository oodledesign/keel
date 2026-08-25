'use client';

import { useEffect, useState } from 'react';

import { ArrowUpRight, MoreHorizontal } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';

import { HapticLink } from '~/components/haptic-link';
import type { DashboardPresetId } from '~/config/dashboard-presets.config';
import pathsConfig from '~/config/paths.config';
import { timeOfDayGreeting } from '~/lib/time-of-day-greeting';

import { DashboardPresetSelector } from './dashboard-preset-selector';

type Props = {
  accountId: string;
  accountSlug: string;
  activePresetId: DashboardPresetId | null;
  recommendedPresetId: DashboardPresetId;
};

export function DashboardWorkHomeHeader({
  accountId,
  accountSlug,
  activePresetId,
  recommendedPresetId,
}: Props) {
  const [greeting, setGreeting] = useState('Good morning');
  const [layoutOpen, setLayoutOpen] = useState(false);

  useEffect(() => {
    setGreeting(timeOfDayGreeting());
  }, []);

  const plannerHref = pathsConfig.app.accountPlanner.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="flex items-start justify-between gap-3 border-0 bg-transparent px-4 py-2 lg:px-6">
      <div className="min-w-0 space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-[var(--workspace-shell-text)]">
          {greeting}
        </h1>
        <HapticLink
          href={plannerHref}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--ozer-accent)]"
        >
          Planner
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </HapticLink>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
            aria-label="Dashboard options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setLayoutOpen(true)}>
            Layout…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={layoutOpen} onOpenChange={setLayoutOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Dashboard layout</SheetTitle>
            <SheetDescription>
              Choose a starting layout. You can change this any time — one click
              applies it immediately.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <DashboardPresetSelector
              accountId={accountId}
              accountSlug={accountSlug}
              activePresetId={activePresetId}
              recommendedPresetId={recommendedPresetId}
              compact
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
