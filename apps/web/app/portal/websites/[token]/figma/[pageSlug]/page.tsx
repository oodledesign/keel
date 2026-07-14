import { notFound } from 'next/navigation';

import { WireframePuckPage } from '~/home/[account]/websites/_components/site-studio/wireframe-puck-page';
import {
  getWebsiteShareByToken,
  shareScopeAllowsWireframes,
} from '~/home/[account]/websites/_lib/server/site-studio.service';
import { migrateSitemapPages } from '~/lib/websites/sitemap-document';

interface FigmaWireframeRenderPageProps {
  params: Promise<{ token: string; pageSlug: string }>;
}

/**
 * Chrome-less wireframe page for html.to.design / Playwright capture.
 * Guarded by website_shares token; requires wireframes|design|full scope.
 */
export default async function FigmaWireframeRenderPage({
  params,
}: FigmaWireframeRenderPageProps) {
  const { token, pageSlug } = await params;
  if (!token || !pageSlug) notFound();

  const share = await getWebsiteShareByToken(token);
  if (!share) notFound();
  if (!shareScopeAllowsWireframes(share.scope)) {
    notFound();
  }

  const sitemap = migrateSitemapPages(share.sitemap);
  const slug = decodeURIComponent(pageSlug).toLowerCase();
  const page =
    sitemap.find((item) => item.slug.toLowerCase() === slug) ??
    (slug === 'home' || slug === 'index'
      ? sitemap.find((item) => item.slug === 'home' || item.slug === 'index')
      : null);

  if (!page) notFound();

  const wireframe =
    share.wireframes.find((item) => item.pageId === page.id) ??
    share.wireframes.find(
      (item) => item.title?.toLowerCase() === page.title.toLowerCase(),
    ) ??
    null;

  const sections = wireframe?.sections ?? [];

  return (
    <div className="min-h-svh bg-[#f7f6f3] text-[#1c1b1a]">
      <div
        data-figma-wireframe-root
        data-page-slug={page.slug}
        className="mx-auto w-[1440px] max-w-full bg-[#f7f6f3]"
      >
        {sections.length > 0 ? (
          <WireframePuckPage
            sections={sections}
            wireframe
            chromeLess
            className="rounded-none border-0 shadow-none"
          />
        ) : (
          <main className="px-8 py-12 font-sans">
            <h1 className="m-0 text-3xl font-semibold">{page.title}</h1>
            <p className="mt-3 opacity-70">
              No wireframe sections yet for this page.
            </p>
          </main>
        )}
      </div>
    </div>
  );
}
