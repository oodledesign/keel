import Link from 'next/link';

import { Lock, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

/**
 * Site Studio add-on upsell — subscribe from Billing (£19/mo · £190/yr).
 */
export function SiteStudioUpsell({
  accountSlug,
  lockedTabLabel,
}: {
  accountSlug: string;
  /** Optional tab name when this card is shown inside a locked tab. */
  lockedTabLabel?: string;
}) {
  const billingHref = `${pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  )}?addon=site_studio#addons`;

  return (
    <div className="rounded-xl border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)]/30 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--workspace-shell-panel)]">
          <Lock className="h-4 w-4 text-[var(--ozer-accent)]" aria-hidden />
        </div>
        <div className="max-w-xl space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text)]">
            <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
            Site Studio
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
            From £19/mo or £190/yr. Unlock Brief, Design, Search, Export, and
            Build for this workspace.
          </p>
          <Button asChild size="sm">
            <Link href={billingHref}>Subscribe to Site Studio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
