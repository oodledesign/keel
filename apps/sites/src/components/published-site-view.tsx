'use client';

import { useMemo } from 'react';

import { Render } from '@kit/site-blocks-core';
import { resolveSiteBlocksConfig } from '@kit/site-blocks-workspaces';

type PublishedSiteViewProps = {
  data: Record<string, unknown>;
  /** Workspace account slug — resolves that workspace's custom block pack. */
  accountSlug?: string | null;
};

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
  return <Render config={config} data={data as never} />;
}
