import { cn } from '@kit/ui/utils';

import { circleTierBadgeClass, getCircleTierMeta } from '../_lib/circle-tiers';
import type { PersonCircleTier } from '../_lib/schema/people.schema';

type CircleTierBadgeProps = {
  tier: PersonCircleTier;
  className?: string;
  showFullLabel?: boolean;
};

export function CircleTierBadge({
  tier,
  className,
  showFullLabel = false,
}: CircleTierBadgeProps) {
  const meta = getCircleTierMeta(tier);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        circleTierBadgeClass(tier),
        className,
      )}
    >
      {showFullLabel ? meta.label : meta.shortLabel}
    </span>
  );
}
