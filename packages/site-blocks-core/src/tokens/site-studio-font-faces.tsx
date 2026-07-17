'use client';

import { siteStudioFontStylesheetUrls } from './font-links';
import type { ResolvableStyleTokens } from './resolve-tokens';

export function SiteStudioFontFaces({
  tokens,
}: {
  tokens: Pick<ResolvableStyleTokens, 'typography'> | null | undefined;
}) {
  if (!tokens?.typography) return null;

  const { displayFamily, bodyFamily, weights } = tokens.typography;
  const urls = siteStudioFontStylesheetUrls({
    displayFamily,
    bodyFamily,
    weights: [weights.regular, weights.medium, weights.bold],
  });

  if (urls.length === 0) return null;

  return (
    <>
      {urls.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </>
  );
}
