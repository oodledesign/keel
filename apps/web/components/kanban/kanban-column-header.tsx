'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  kanbanColumnHeaderClassName,
  kanbanColumnInitials,
} from '~/lib/projects/projects-kanban-layout';

export function KanbanColumnHeader({
  label,
  count,
  minimized,
  className,
}: {
  label: string;
  count: number;
  minimized: boolean;
  className?: string;
}) {
  const initials = kanbanColumnInitials(label);
  const headingClassName = cn(
    'text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase',
    minimized && 'flex w-full justify-center',
  );

  return (
    <header
      className={kanbanColumnHeaderClassName({ minimized, className })}
      data-test="kanban-column-header"
      data-minimized={minimized ? 'true' : 'false'}
    >
      {minimized ? (
        <Tooltip delayDuration={0} disableHoverableContent>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={headingClassName}
              aria-label={label}
            >
              <span aria-hidden>{initials}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      ) : (
        <h3 className={headingClassName}>
          <span>{label}</span>
          <span className="ml-2">{count}</span>
        </h3>
      )}
    </header>
  );
}
