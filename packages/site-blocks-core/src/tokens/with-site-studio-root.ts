'use client';

import {
  type ReactNode,
  createContext,
  createElement,
  useContext,
} from 'react';

import type { Config } from '@puckeditor/core';

import {
  DEFAULT_RESOLVABLE_STYLE_TOKENS,
  type ResolvableStyleTokens,
} from './resolve-tokens';
import { SiteStudioTokenRoot } from './site-studio-token-root';

const SiteStudioTokensContext = createContext<ResolvableStyleTokens | null>(
  null,
);

export function SiteStudioTokensProvider({
  tokens,
  children,
}: {
  tokens: ResolvableStyleTokens;
  children: ReactNode;
}) {
  return createElement(
    SiteStudioTokensContext.Provider,
    { value: tokens },
    children,
  );
}

export function useSiteStudioTokens() {
  return useContext(SiteStudioTokensContext);
}

function SiteStudioTokenRootConnected({
  children,
  fallbackTokens,
}: {
  children?: ReactNode;
  fallbackTokens?: ResolvableStyleTokens;
}) {
  const tokens =
    useContext(SiteStudioTokensContext) ??
    fallbackTokens ??
    DEFAULT_RESOLVABLE_STYLE_TOKENS;

  return createElement(SiteStudioTokenRoot, {
    tokens,
    children: children ?? null,
  });
}

/**
 * Attach a Puck `root` wrapper that reads Site Studio tokens from
 * `SiteStudioTokensProvider` (so the Puck config can stay stable while
 * Design / Type tab edits update live).
 */
export function withSiteStudioRootConfig<UserConfig extends Config>(
  config: UserConfig,
  fallbackTokens?: ResolvableStyleTokens,
): UserConfig {
  const existingRoot = config.root;

  return {
    ...config,
    root: {
      ...existingRoot,
      render: (props: { children?: ReactNode }) =>
        createElement(SiteStudioTokenRootConnected, {
          fallbackTokens,
          children: props.children ?? null,
        }),
    },
  } as UserConfig;
}
