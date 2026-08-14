import { cn } from '@kit/ui/utils';

import {
  sectorBadgeClass,
  splitSectorLabels,
} from '~/lib/commercial/commercial-constants';

export function ListingSectorPills({
  sector,
  className,
  size = 'sm',
}: {
  sector: string | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const parts = splitSectorLabels(sector);
  if (parts.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {parts.map((part) => (
        <span
          key={part}
          className={cn(
            'inline-flex max-w-full truncate rounded-full font-medium',
            size === 'md'
              ? 'px-2.5 py-0.5 text-[11px]'
              : 'px-2 py-0.5 text-[10px]',
            sectorBadgeClass(part),
          )}
          title={part}
        >
          {part}
        </span>
      ))}
    </div>
  );
}
