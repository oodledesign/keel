'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  DASHBOARD_PRESETS,
  type DashboardPresetId,
} from '~/config/dashboard-presets.config';

import { saveDashboardPresetAction } from '../_lib/server/dashboard-preset.actions';
import { DashboardPresetThumbnail } from './dashboard-preset-thumbnail';

type Props = {
  accountId: string;
  accountSlug: string;
  activePresetId: DashboardPresetId | null;
  recommendedPresetId: DashboardPresetId;
  onApplied?: (presetId: DashboardPresetId) => void;
  compact?: boolean;
};

export function DashboardPresetSelector({
  accountId,
  accountSlug,
  activePresetId,
  recommendedPresetId,
  onApplied,
  compact = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const selectPreset = (presetId: DashboardPresetId) => {
    startTransition(async () => {
      try {
        await saveDashboardPresetAction({
          accountId,
          accountSlug,
          presetId,
        });
        onApplied?.(presetId);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update dashboard layout',
        );
      }
    });
  };

  return (
    <div
      className={cn(
        'grid gap-3',
        compact
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
      )}
    >
      {DASHBOARD_PRESETS.map((preset) => {
        const isActive = activePresetId === preset.id;
        const isRecommended = recommendedPresetId === preset.id;

        return (
          <button
            key={preset.id}
            type="button"
            disabled={isPending}
            onClick={() => selectPreset(preset.id)}
            className={cn(
              'rounded-[var(--ozer-radius-xl)] border p-3 text-left transition-colors',
              isActive
                ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] hover:border-[var(--ozer-accent)]/40',
              isPending && 'opacity-70',
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
            <p className="mt-1 text-xs leading-snug text-[var(--workspace-shell-text-muted)]">
              {preset.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
