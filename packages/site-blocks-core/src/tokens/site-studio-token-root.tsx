'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';

import { SiteStudioFontFaces } from './site-studio-font-faces';
import type { ResolvableStyleTokens } from './resolve-tokens';
import { resolveTokensStyle } from './resolve-tokens';

/** Wraps Puck preview / published page content with design tokens as CSS variables. */
export function SiteStudioTokenRoot({
  tokens,
  children,
  className = 'sb-root min-h-full w-full',
}: {
  tokens: ResolvableStyleTokens;
  children: ReactNode;
  className?: string;
}) {
  const style = useMemo(() => resolveTokensStyle(tokens), [tokens]);

  return (
    <div className={className} style={style as CSSProperties} data-site-studio-root>
      <SiteStudioFontFaces tokens={tokens} />
      {children}
    </div>
  );
}
