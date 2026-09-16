import { cn } from '@kit/ui/utils';

import {
  surveyStatusBadgeClass,
  surveyStatusDisplayLabel,
} from '~/lib/building-surveyor/survey-status';

type SurveyStatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
};

/**
 * Colour-coded survey status pill — dashboard recent list, surveys table,
 * and the survey hub. Labels are British English title case (Draft, not draft).
 */
export function SurveyStatusBadge({
  status,
  className,
  size = 'sm',
}: SurveyStatusBadgeProps) {
  const label = surveyStatusDisplayLabel(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' && 'px-2.5 py-0.5 text-[11px]',
        size === 'md' && 'px-3 py-1 text-xs',
        surveyStatusBadgeClass(status),
        className,
      )}
    >
      {label}
    </span>
  );
}
