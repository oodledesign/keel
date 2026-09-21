'use client';

import { forwardRef } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

const AVATAR_SIZE_CLASS = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
} as const;

export function listingMemberInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const ListingMemberAvatar = forwardRef<
  HTMLSpanElement,
  {
    name: string;
    pictureUrl: string | null;
    size?: keyof typeof AVATAR_SIZE_CLASS;
    className?: string;
  }
>(function ListingMemberAvatar(
  { name, pictureUrl, size = 'sm', className },
  ref,
) {
  const initials = listingMemberInitials(name);

  return (
    <span
      ref={ref}
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full',
        AVATAR_SIZE_CLASS[size],
        className,
      )}
    >
      {pictureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote member avatars; Next Image domains not configured for all sources
        <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[var(--workspace-shell-sidebar-accent)] font-semibold text-[var(--workspace-shell-text)]/70">
          {initials}
        </span>
      )}
    </span>
  );
});

export function ListingAgentAvatarStack({
  agents,
  size = 'md',
}: {
  agents: Array<{
    userId: string;
    name: string;
    pictureUrl: string | null;
  }>;
  size?: 'sm' | 'md';
}) {
  if (agents.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center -space-x-2">
        {agents.slice(0, 4).map((agent) => (
          <Tooltip key={agent.userId}>
            <TooltipTrigger asChild>
              <ListingMemberAvatar
                name={agent.name}
                pictureUrl={agent.pictureUrl}
                size={size}
                className="ring-2 ring-[var(--workspace-shell-panel)]"
              />
            </TooltipTrigger>
            <TooltipContent side="top">{agent.name}</TooltipContent>
          </Tooltip>
        ))}
        {agents.length > 4 ? (
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] font-medium text-[var(--workspace-shell-text)]/60 ring-2 ring-[var(--workspace-shell-panel)]',
              AVATAR_SIZE_CLASS[size],
            )}
          >
            +{agents.length - 4}
          </span>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
