import reservedWorkspaceUrlSegments from '../reserved-workspace-url-segments.json' with { type: 'json' };

/** First URL segment under `/app/` reserved for personal or system routes — not workspace slugs. */
export const RESERVED_WORKSPACE_URL_SEGMENTS = [
  ...reservedWorkspaceUrlSegments,
] as readonly string[];

export function isReservedWorkspaceUrlSegment(segment: string): boolean {
  return RESERVED_WORKSPACE_URL_SEGMENTS.includes(segment.toLowerCase());
}

/**
 * path-to-regexp segment for Next.js rewrites: `/app/:account(...)`.
 * Reserved segments must match the full slug only — not prefixes (e.g. `homegroup` ≠ `home`).
 */
export function workspaceAccountUrlSegmentPattern(): string {
  const reserved = RESERVED_WORKSPACE_URL_SEGMENTS.join('|');
  return `(?!(?:${reserved})$)[a-z0-9-]+`;
}

export function workspaceAccountHomePath(slug: string): string {
  return `/app/${slug}`;
}
