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

import { setWebsiteListingFeedInclusionAction } from '../../commercial-publishing/_lib/server/server-actions';

const WEBSITE_FEED_HELP =
  'On = in the website feed when this disposal is on-market (Marketing / Under offer). Off = not on the site.';

export function ListingWebsiteFeedToggle({
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
  /** Return false to cancel enabling (e.g. marketing readiness confirm). */
  onBeforeEnable?: () => boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const onCheckedChange = (next: boolean) => {
    if (disabled) return;
    if (next && onBeforeEnable && !onBeforeEnable()) {
      return;
    }
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        const result = await setWebsiteListingFeedInclusionAction({
          accountId,
          listingId,
          enabled: next,
        });
        setEnabled(result.enabled);
        toast.success(
          result.enabled
            ? 'Website: included in the site feed (when on-market)'
            : 'Website: switched off for this disposal',
        );
        router.refresh();
      } catch (error) {
        setEnabled(previous);
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update website feed',
        );
      }
    });
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Website
          </p>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex shrink-0 rounded-full text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-text)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
                  aria-label="About website feed"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {WEBSITE_FEED_HELP}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {enabled ? 'In the website feed when on-market' : 'Not on the site'}
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={pending || disabled}
        onCheckedChange={onCheckedChange}
        aria-label="Include listing in website feed"
      />
    </div>
  );
}
