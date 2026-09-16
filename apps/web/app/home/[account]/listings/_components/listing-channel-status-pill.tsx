import { AlertTriangle, Check, X } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type { ChannelPublishStatus } from '~/lib/commercial/channel-publish-status';

function ChannelStatusIcon({ status }: { status: ChannelPublishStatus }) {
  if (status.outOfSync || status.state === 'blocked') {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />;
  }
  if (status.state === 'live') {
    return <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
  }
  return (
    <X
      className="h-3.5 w-3.5 text-[var(--workspace-shell-text)]/35"
      aria-hidden
    />
  );
}

function channelStatusTone(status: ChannelPublishStatus) {
  if (status.outOfSync) {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200';
  }
  if (status.state === 'live') {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
  }
  if (status.state === 'blocked') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200';
  }
  return 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';
}

export function ChannelStatusPill({
  label,
  status,
  className,
}: {
  label: string;
  status: ChannelPublishStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        channelStatusTone(status),
        className,
      )}
    >
      <ChannelStatusIcon status={status} />
      <span>{label}</span>
      <span className="font-normal opacity-80">{status.label}</span>
    </span>
  );
}
