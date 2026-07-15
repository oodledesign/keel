import {
  type BuildConfigOptions,
  type SiteBlocksConfig,
  buildConfig,
} from '@kit/site-blocks-core/config';

import { getWorkspacePack } from './registry';

/**
 * Build the Puck config for a workspace: core Site Studio blocks plus the
 * workspace's custom block pack (if one is registered for the slug).
 *
 * Used by both the Ozer Sites Puck editor and the public renderer so that
 * the same account slug always yields the same component set.
 */
export function resolveSiteBlocksConfig(
  accountSlug: string | null | undefined,
  options: Omit<BuildConfigOptions, 'extraComponents' | 'extraCategories'> = {},
): SiteBlocksConfig {
  const pack = getWorkspacePack(accountSlug);

  if (!pack) {
    return buildConfig(options);
  }

  return buildConfig({
    ...options,
    extraComponents: pack.components,
    extraCategories: pack.categories ?? {
      [pack.slug]: {
        title: pack.label,
        components: Object.keys(pack.components),
      },
    },
  });
}
