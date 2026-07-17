'use client';

import { useEffect, useMemo } from 'react';

import { Render } from '@kit/site-blocks-core';
import { resolveSiteBlocksConfig } from '@kit/site-blocks-workspaces';

type PublishedSiteViewProps = {
  data: Record<string, unknown>;
  /** Workspace account slug — resolves that workspace's custom block pack. */
  accountSlug?: string | null;
};

function contentBlockTypes(data: Record<string, unknown>): string[] {
  const content = data.content;
  if (!Array.isArray(content)) return [];
  return content
    .map((item) =>
      item && typeof item === 'object' && 'type' in item
        ? String((item as { type?: unknown }).type ?? '')
        : '',
    )
    .filter(Boolean);
}

/**
 * Client boundary for Puck <Render>. Must not run as a Server Component —
 * Puck injects non-serializable helpers (renderDropZone, etc.) into block props.
 */
export function PublishedSiteView({
  data,
  accountSlug,
}: PublishedSiteViewProps) {
  const config = useMemo(
    () => resolveSiteBlocksConfig(accountSlug),
    [accountSlug],
  );

  useEffect(() => {
    const registered = new Set(Object.keys(config.components ?? {}));
    const missing = contentBlockTypes(data).filter((type) => !registered.has(type));
    if (missing.length === 0) return;

    console.warn(
      `[ozer-sites] ${missing.length} published block(s) are not registered in this deployment: ${missing.join(', ')}. Redeploy ozer-sites after adding workspace blocks.`,
    );
  }, [config, data]);

  return <Render config={config} data={data as never} />;
}
