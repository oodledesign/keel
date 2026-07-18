'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';

import type { ResolvableStyleTokens } from './resolve-tokens';
import {
  buildTokensResponsiveStyleSheet,
  resolveTokensStyle,
} from './resolve-tokens';
import { SiteStudioFontFaces } from './site-studio-font-faces';

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
  const responsiveCss = useMemo(
    () => buildTokensResponsiveStyleSheet(tokens, '[data-site-studio-root]'),
    [tokens],
  );

  return (
    <div
      className={className}
      style={style as CSSProperties}
      data-site-studio-root
    >
      {responsiveCss ? <style>{responsiveCss}</style> : null}
      <SiteStudioFontFaces tokens={tokens} />
      {children}
    </div>
  );
}
