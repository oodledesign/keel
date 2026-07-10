import Link from 'next/link';

import { Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

export function SiteStudioUpsell({ accountSlug }: { accountSlug: string }) {
  const billingPath = `${pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  )}?addon=site_studio#addons`;

  return (
    <div className="rounded-xl border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)]/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text)]">
            <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
            Site Studio
          </p>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            AI-led website planning: structured brief, canvas sitemap, section
            wireframes, style system, SEO/GEO/AEO, and export packs for Webflow
            (Client-First), Astro, Next.js, and Cursor prompts.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={billingPath}>Add Site Studio</Link>
        </Button>
      </div>
    </div>
  );
}
