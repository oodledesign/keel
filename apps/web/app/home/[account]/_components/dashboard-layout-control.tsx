'use client';

import { LayoutGrid } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@kit/ui/sheet';

import type { DashboardPresetId } from '~/config/dashboard-presets.config';

import { DashboardPresetSelector } from './dashboard-preset-selector';

type Props = {
  accountId: string;
  accountSlug: string;
  activePresetId: DashboardPresetId | null;
  recommendedPresetId: DashboardPresetId;
};

export function DashboardLayoutControl({
  accountId,
  accountSlug,
  activePresetId,
  recommendedPresetId,
}: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Layout
        </Button>
      </SheetTrigger>
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
  );
}
