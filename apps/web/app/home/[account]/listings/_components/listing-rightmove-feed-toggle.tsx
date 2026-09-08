'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Info } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';

import { setRightmoveListingInclusionAction } from '../../commercial-publishing/_lib/server/server-actions';

const RIGHTMOVE_FEED_HELP =
  'On = publish this disposal to Rightmove now. Off = remove it from Rightmove. Bulk “push all” in Website & portals is for many listings at once.';

export function ListingRightmoveFeedToggle({
  accountId,
  listingId,
  initialEnabled,
  disabled = false,
  onBeforeEnable,
}: {
  accountId: string;
  listingId: string;
  initialEnabled: boolean;
  disabled?: boolean;
  onBeforeEnable?: () => boolean | Promise<boolean>;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const persistEnabled = (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        const result = await setRightmoveListingInclusionAction({
          accountId,
          listingId,
          enabled: next,
        });
        if (result.enabled !== next) {
          setEnabled(previous);
          toast.error(
            next
              ? 'Rightmove did not turn on for this disposal'
              : 'Rightmove did not turn off for this disposal',
          );
          router.refresh();
          return;
        }
        setEnabled(result.enabled);
        toast.success(
          result.enabled
            ? 'Rightmove: published this disposal'
            : 'Rightmove: unpublished this disposal',
        );
        router.refresh();
      } catch (error) {
        setEnabled(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not update Rightmove',
        );
      }
    });
  };

  const onCheckedChange = (next: boolean) => {
    if (disabled) return;
    if (next && onBeforeEnable) {
      void Promise.resolve(onBeforeEnable()).then((allowed) => {
        if (allowed) persistEnabled(true);
      });
      return;
    }
    persistEnabled(next);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Rightmove
          </p>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex shrink-0 rounded-full text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-text)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
                  aria-label="About Rightmove publishing"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {RIGHTMOVE_FEED_HELP}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {enabled
            ? pending
              ? 'Publishing to Rightmove…'
              : 'Published to Rightmove'
            : pending
              ? 'Updating Rightmove…'
              : 'Not on Rightmove'}
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={pending || disabled}
        onCheckedChange={onCheckedChange}
        aria-label="Publish this disposal to Rightmove"
        data-test="rightmove-channel-toggle"
      />
    </div>
  );
}
