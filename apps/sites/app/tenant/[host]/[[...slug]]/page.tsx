import { notFound } from 'next/navigation';

import { Render, buildConfig, resolveTokensStyle } from '@kit/site-blocks-core';

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

  const config = buildConfig();
  const style = resolveTokensStyle(resolved.themeTokens as never);

  return (
    <html lang="en-GB">
      <head>
        <title>{resolved.title || resolved.siteName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={style}>
        <Render config={config} data={resolved.data as never} />
      </body>
    </html>
  );
}
