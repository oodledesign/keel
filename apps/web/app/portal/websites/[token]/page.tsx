import { notFound } from 'next/navigation';

import { getWebsiteShareByToken } from '~/home/[account]/websites/_lib/server/site-studio.service';

import { PortalWebsitePlanningView } from '../../_components/portal-website-planning-view';

interface PortalWebsiteSharePageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalWebsiteSharePage({
  params,
}: PortalWebsiteSharePageProps) {
  const { token } = await params;
  if (!token) notFound();

  const share = await getWebsiteShareByToken(token);
  if (!share) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2 border-b border-[color:var(--workspace-shell-border)] pb-6">
        <p className="text-xs uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
          Website planning
        </p>
        <h1 className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
          {share.websiteName}
        </h1>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Review the sitemap and wireframes below. Approve each page or send
          change requests — no Ozer login required.
        </p>
      </header>

      <PortalWebsitePlanningView
        scope={share.scope}
        sitemap={share.sitemap}
        wireframes={share.wireframes}
        style={share.style}
        shareToken={token}
      />
    </div>
  );
}
