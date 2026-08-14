'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

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

  const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center -space-x-2">
        {agents.slice(0, 4).map((agent) => (
          <Tooltip key={agent.userId}>
            <TooltipTrigger asChild>
              <span
                className={`relative inline-flex overflow-hidden rounded-full ring-2 ring-[var(--workspace-shell-panel)] ${dim}`}
              >
                {agent.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agent.pictureUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[var(--workspace-shell-sidebar-accent)] font-semibold text-[var(--workspace-shell-text)]/70">
                    {initials(agent.name)}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{agent.name}</TooltipContent>
          </Tooltip>
        ))}
        {agents.length > 4 ? (
          <span
            className={`inline-flex items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] font-medium text-[var(--workspace-shell-text)]/60 ring-2 ring-[var(--workspace-shell-panel)] ${dim}`}
          >
            +{agents.length - 4}
          </span>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
