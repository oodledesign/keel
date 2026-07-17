import type { Config } from '@puckeditor/core';
import { createElement, type ReactNode } from 'react';

import type { ResolvableStyleTokens } from './resolve-tokens';
import { SiteStudioTokenRoot } from './site-studio-token-root';

/**
 * Attach a Puck `root` wrapper that applies Site Studio design tokens inside
 * the preview iframe (Puck enables iframe preview by default).
 */
export function withSiteStudioRootConfig<UserConfig extends Config>(
  config: UserConfig,
  tokens: ResolvableStyleTokens,
): UserConfig {
  const existingRoot = config.root;

  return {
    ...config,
    root: {
      ...existingRoot,
      render: (props: { children?: ReactNode }) =>
        createElement(SiteStudioTokenRoot, {
          tokens,
          children: props.children ?? null,
        }),
    },
  } as UserConfig;
}
