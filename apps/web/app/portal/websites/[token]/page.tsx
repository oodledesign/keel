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

  const scopeCopy =
    share.scope === 'sitemap'
      ? 'Review the sitemap. Approve each page or send change requests — no Ozer login required.'
      : share.scope === 'wireframes'
        ? 'Review the sitemap and wireframes. Approve each page or send change requests — no Ozer login required.'
        : share.scope === 'design'
          ? 'Review the sitemap, wireframes, and design tokens. Approve each page or send change requests — no Ozer login required.'
          : 'Review the full planning pack. Approve each page or send change requests — no Ozer login required.';

  return (
    <div className="min-h-svh w-full bg-[var(--ozer-cream-50)]">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <header className="mb-6 space-y-2 border-b border-[color:var(--workspace-shell-border)] pb-6">
          <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Website planning
          </p>
          <h1 className="font-[family-name:var(--ozer-font-display)] text-3xl font-bold tracking-tight text-[var(--ozer-plum-900)] sm:text-4xl">
            {share.websiteName}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--workspace-shell-text-muted)] sm:text-base">
            {scopeCopy}
          </p>
        </header>

        <PortalWebsitePlanningView
          scope={share.scope}
          sitemap={share.sitemap}
          wireframes={share.wireframes}
          style={share.style}
          brief={share.brief}
          shareToken={token}
          websiteName={share.websiteName}
        />
      </div>
    </div>
  );
}
