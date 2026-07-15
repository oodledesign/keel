import { notFound } from 'next/navigation';

import { resolveTokensStyle } from '@kit/site-blocks-core';

import { PublishedSiteView } from '~/components/published-site-view';
import { loadPublishedPage } from '~/lib/resolve-site';

import '@kit/site-blocks-core/tokens.css';

type PageProps = {
  params: Promise<{ host: string; slug?: string[] }>;
};

export default async function SitesCatchAllPage({ params }: PageProps) {
  const { host, slug } = await params;
  const slugPath = (slug ?? []).join('/');
  const resolved = await loadPublishedPage(decodeURIComponent(host), slugPath);

  if (!resolved) {
    notFound();
  }

  const style = resolveTokensStyle(resolved.themeTokens as never);

  return (
    <html lang="en-GB">
      <head>
        <title>{resolved.title || resolved.siteName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="sb-root" style={style}>
        <PublishedSiteView data={resolved.data} />
      </body>
    </html>
  );
}
