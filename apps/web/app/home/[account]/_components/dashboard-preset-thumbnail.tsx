'use client';

import { cn } from '@kit/ui/utils';

import type { DashboardCardId } from '~/config/dashboard-presets.config';
import {
  DASHBOARD_CARD_THUMB_COLOURS,
  type DashboardPresetId,
  getDashboardPreset,
} from '~/config/dashboard-presets.config';

type Props = {
  presetId: DashboardPresetId;
  className?: string;
};

const SIZE_BY_INDEX = [1, 0.72, 0.58, 0.5, 0.42, 0.36, 0.32, 0.28];

export function DashboardPresetThumbnail({ presetId, className }: Props) {
  const preset = getDashboardPreset(presetId);
  const cards = preset.cardOrder.slice(0, 6);

  return (
    <div
      aria-hidden
      className={cn(
        'flex h-24 w-full flex-col justify-center gap-1 rounded-[var(--ozer-radius-lg)] bg-[var(--workspace-shell-sidebar-accent)] p-2.5',
        className,
      )}
    >
      {cards.map((cardId, index) => (
        <ThumbPill
          key={`${presetId}-${cardId}`}
          cardId={cardId}
          prominence={SIZE_BY_INDEX[index] ?? 0.28}
        />
      ))}
    </div>
  );
}

function ThumbPill({
  cardId,
  prominence,
}: {
  cardId: DashboardCardId;
  prominence: number;
}) {
  return (
    <div
      className="h-2.5 rounded-full"
      style={{
        width: `${Math.round(prominence * 100)}%`,
        backgroundColor: DASHBOARD_CARD_THUMB_COLOURS[cardId],
        opacity: 0.45,
      }}
    />
  );
}
