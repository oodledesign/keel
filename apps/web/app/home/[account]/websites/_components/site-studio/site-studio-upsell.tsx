import { Lock, Sparkles } from 'lucide-react';

/**
 * Pre-launch upsell: Site Studio is grantable via Super Admin, not Billing yet.
 */
export function SiteStudioUpsell({
  lockedTabLabel,
}: {
  /** Optional tab name when this card is shown inside a locked tab. */
  lockedTabLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)]/30 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--workspace-shell-panel)]">
          <Lock className="h-4 w-4 text-[var(--ozer-accent)]" aria-hidden />
        </div>
        <div className="max-w-xl space-y-2">
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
            Not in Billing yet. For development, grant{' '}
            <code className="rounded bg-[var(--workspace-shell-sidebar-accent)] px-1 py-0.5 text-[var(--workspace-shell-text)]">
              addon_site_studio
            </code>{' '}
            on this workspace in Super Admin → Accounts → Billing grants.
          </p>
        </div>
      </div>
    </div>
  );
}
