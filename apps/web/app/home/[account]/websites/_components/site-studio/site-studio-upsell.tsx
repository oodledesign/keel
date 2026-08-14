import Link from 'next/link';

import { Lock, Sparkles } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

/**
 * Site Studio is in development — no subscribe CTA.
 */
export function SiteStudioUpsell({
  accountSlug,
  lockedTabLabel,
}: {
  accountSlug: string;
  /** Optional tab name when this card is shown inside a locked tab. */
  lockedTabLabel?: string;
}) {
  const addonsHref = pathsConfig.app.accountAddonsSettings.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="rounded-xl border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)]/30 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--workspace-shell-panel)]">
          <Lock className="h-4 w-4 text-[var(--ozer-accent)]" aria-hidden />
        </div>
        <div className="max-w-xl space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text)]">
            <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
            Site Studio
            <Badge variant="secondary">Coming soon</Badge>
            {lockedTabLabel ? (
              <span className="font-normal text-[var(--workspace-shell-text-muted)]">
                · {lockedTabLabel} locked
              </span>
            ) : null}
          </p>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            AI-led website planning: structured brief, canvas sitemap, section
            wireframes, style system, SEO/GEO/AEO, and export packs for Webflow
            (Client-First), Astro, Next.js, and Cursor prompts.
          </p>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Site Studio isn’t available to subscribe yet. See the apps catalog
            for what’s live and what’s on the roadmap.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={addonsHref}>View apps & add-ons</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
