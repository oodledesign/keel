import { cn } from '@kit/ui/utils';

import {
  WIP_WORK_TYPE_LABELS,
  normalizeWipWorkType,
} from '~/lib/commercial/wip-work-type';

/**
 * Solid colours so the pill stays legible on any row tint, in light and dark
 * mode. Agency is the default work type and gets no pill.
 */
const PILL_CLASS = {
  professional: 'border-sky-800 bg-sky-700 text-white',
  management: 'border-emerald-800 bg-emerald-700 text-white',
} as const;

export function WipWorkTypePill({
  workType,
  className,
}: {
  workType: string | null | undefined;
  className?: string;
}) {
  const key = normalizeWipWorkType(workType);
  if (!key || key === 'agency') return null;

  return (
    <span
      data-test="wip-work-type-pill"
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full border px-2 align-middle text-[10px] font-semibold tracking-wide',
        PILL_CLASS[key],
        className,
      )}
    >
      {WIP_WORK_TYPE_LABELS[key]}
    </span>
  );
}
