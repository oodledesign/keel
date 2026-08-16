'use client';

import { useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  DASHBOARD_PRESETS,
  DEFAULT_DASHBOARD_PRESET_ID,
  type DashboardPresetId,
} from '~/config/dashboard-presets.config';

import { saveDashboardPresetAction } from '../_lib/server/dashboard-preset.actions';
import { DashboardPresetThumbnail } from './dashboard-preset-thumbnail';

type Props = {
  accountId: string;
  accountSlug: string;
  recommendedPresetId: DashboardPresetId;
  open: boolean;
};

export function DashboardPresetOnboardingDialog({
  accountId,
  accountSlug,
  recommendedPresetId,
  open: initiallyOpen,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [selected, setSelected] =
    useState<DashboardPresetId>(recommendedPresetId);
  const [isPending, startTransition] = useTransition();
  const appliedRef = useRef(false);

  const apply = (presetId: DashboardPresetId) => {
    if (appliedRef.current) return;
    appliedRef.current = true;

    startTransition(async () => {
      try {
        await saveDashboardPresetAction({
          accountId,
          accountSlug,
          presetId,
          markOnboardingComplete: true,
        });
        setOpen(false);
        router.refresh();
      } catch (error) {
        appliedRef.current = false;
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not save dashboard layout',
        );
      }
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && open) {
      apply(DEFAULT_DASHBOARD_PRESET_ID);
      return;
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>How would you like your dashboard?</DialogTitle>
          <DialogDescription>
            Pick a layout that matches how you work. You can change this later
            from Layout on the dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DASHBOARD_PRESETS.map((preset) => {
            const isSelected = selected === preset.id;
            const isRecommended = recommendedPresetId === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                disabled={isPending}
                onClick={() => setSelected(preset.id)}
                className={cn(
                  'rounded-[var(--ozer-radius-xl)] border p-3 text-left transition-colors',
                  isSelected
                    ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                    : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
                )}
              >
                <DashboardPresetThumbnail presetId={preset.id} />
                <div className="mt-3 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                    {preset.label}
                  </p>
                  {isRecommended ? (
                    <span className="rounded-full bg-[var(--ozer-lime-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--ozer-plum-900)]">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => apply(DEFAULT_DASHBOARD_PRESET_ID)}
          >
            Skip
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => apply(selected)}
          >
            Use this layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
