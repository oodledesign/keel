'use client';

import { Render, buildConfig } from '@kit/site-blocks-core';

const puckConfig = buildConfig();

type PublishedSiteViewProps = {
  data: Record<string, unknown>;
};

/**
 * Client boundary for Puck <Render>. Must not run as a Server Component —
 * Puck injects non-serializable helpers (renderDropZone, etc.) into block props.
 */
export function PublishedSiteView({ data }: PublishedSiteViewProps) {
  return <Render config={puckConfig} data={data as never} />;
}
