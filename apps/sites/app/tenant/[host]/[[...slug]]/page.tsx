import { notFound } from 'next/navigation';

import {
  coerceResolvableStyleTokens,
  buildTokensResponsiveStyleSheet,
  resolveTokensStyle,
  siteStudioFontStylesheetUrls,
} from '@kit/site-blocks-core';

import { PublishedSiteView } from '~/components/published-site-view';
import { loadPublishedPage } from '~/lib/resolve-site';

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

  const themeTokens = coerceResolvableStyleTokens(resolved.themeTokens);
  const style = resolveTokensStyle(themeTokens);
  const responsiveCss = buildTokensResponsiveStyleSheet(themeTokens, 'body.sb-root');
  const fontUrls = siteStudioFontStylesheetUrls({
    displayFamily: themeTokens.typography?.displayFamily,
    bodyFamily: themeTokens.typography?.bodyFamily,
    weights: themeTokens.typography?.weights
      ? [
          themeTokens.typography.weights.regular,
          themeTokens.typography.weights.medium,
          themeTokens.typography.weights.bold,
        ]
      : undefined,
  });

  return (
    <html lang="en-GB">
      <head>
        <title>{resolved.title || resolved.siteName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {fontUrls.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {responsiveCss ? <style>{responsiveCss}</style> : null}
      </head>
      <body className="sb-root" style={style}>
        <PublishedSiteView
          data={resolved.data}
          accountSlug={resolved.accountSlug}
        />
      </body>
    </html>
  );
}
