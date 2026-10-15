'use client';

import { cn } from '@kit/ui/utils';

import {
  LEAD_TRAFFIC_LIGHT_LABELS,
  type SurveyorPipelineSettings,
  idleDays,
  leadTrafficLight,
} from '~/lib/building-surveyor/surveyor-lead';

const DOT_CLASS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
} as const;

export function idleLabel(lastActivityAt: string | null | undefined) {
  if (!lastActivityAt) return 'No activity yet';
  const days = idleDays(lastActivityAt);
  if (days === 0) return 'Active today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function LeadTrafficLight({
  lastActivityAt,
  settings,
  className,
}: {
  lastActivityAt: string | null | undefined;
  settings: Pick<SurveyorPipelineSettings, 'leadAmberDays' | 'leadRedDays'>;
  className?: string;
}) {
  const light = leadTrafficLight(lastActivityAt, settings);
  if (!light) return null;
  const label = `${LEAD_TRAFFIC_LIGHT_LABELS[light]} · ${idleLabel(lastActivityAt)}`;
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        DOT_CLASS[light],
        className,
      )}
      title={label}
      role="img"
      aria-label={label}
    />
  );
}
