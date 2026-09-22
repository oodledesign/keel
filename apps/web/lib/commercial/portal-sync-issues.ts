/** How far back “Recent portal sync issues” looks. Older rows are omitted. */
export const PORTAL_SYNC_ISSUE_RECENCY_DAYS = 30;

/** Per-listing failures shown under the grouped credential warning. */
export const PORTAL_SYNC_ISSUE_LIST_LIMIT = 15;

/** Disposals listed inside a collapsed credential warning. */
export const PORTAL_CREDENTIAL_WARNING_SAMPLE = 20;

export type PortalPublicationIssue = {
  id: string;
  listingId: string;
  listingName: string | null;
  portal: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type PortalCredentialWarning = {
  portal: string;
  count: number;
  sample: PortalPublicationIssue[];
  sampleTruncated: boolean;
};

export type PortalSyncIssueSummary = {
  issues: PortalPublicationIssue[];
  issuesTruncated: boolean;
  warnings: PortalCredentialWarning[];
};

const PORTAL_LABELS: Record<string, string> = {
  property_hive: 'Property Hive',
  rightmove: 'Rightmove',
  each: 'EACH',
};

/**
 * Record for a local-only Property Hive unpublish (no REST credentials, or
 * no remote post). XML-feed workspaces still drop the disposal from the
 * website feed. A credentials error here would repeat on every disposal.
 */
export function propertyHiveLocalUnpublishRecord(): {
  status: 'unpublished';
  lastError: null;
} {
  return { status: 'unpublished', lastError: null };
}

export function portalSyncIssueCutoff(
  now = new Date(),
  days = PORTAL_SYNC_ISSUE_RECENCY_DAYS,
): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function portalSyncPortalLabel(portal: string): string {
  return PORTAL_LABELS[portal] ?? portal.replace(/_/g, ' ');
}

/**
 * Workspace-level “credentials not configured” copy written onto many
 * disposals. XML-feed Property Hive workspaces hit this on every local
 * unpublish because REST credentials are optional.
 */
export function isCredentialNotConfiguredError(
  lastError: string | null | undefined,
): boolean {
  return Boolean(lastError && /credentials not configured/i.test(lastError));
}

export function isRecentPortalSyncIssue(
  lastSyncAt: string | null | undefined,
  now = new Date(),
  days = PORTAL_SYNC_ISSUE_RECENCY_DAYS,
): boolean {
  if (!lastSyncAt) return false;
  const time = Date.parse(lastSyncAt);
  if (Number.isNaN(time)) return false;
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return time >= cutoff && time <= now.getTime() + 60_000;
}

export function formatPortalSyncIssueTime(
  iso: string,
  now = new Date(),
): string {
  const date = new Date(iso);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';

  const diffMs = now.getTime() - time;
  if (diffMs < 0) {
    return formatPortalSyncIssueDate(date, now);
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  return formatPortalSyncIssueDate(date, now);
}

function formatPortalSyncIssueDate(date: Date, now: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export function portalCredentialWarningMessage(
  portal: string,
  count: number,
): string {
  const label = portalSyncPortalLabel(portal);
  const disposals =
    count === 1 ? '1 disposal' : `${count.toLocaleString('en-GB')} disposals`;
  const windowLabel = `the last ${PORTAL_SYNC_ISSUE_RECENCY_DAYS} days`;

  if (portal === 'property_hive') {
    return `${label} REST credentials are not configured for this workspace. Website publishing uses the XML feed. ${disposals} in ${windowLabel} were saved with this same credentials message, so they are grouped here.`;
  }

  return `${label} credentials are not configured for this workspace. ${disposals} in ${windowLabel} recorded that same message, so they are grouped here.`;
}

function isGroupedCredentialIssue(
  issue: PortalPublicationIssue,
  unconfigured: ReadonlySet<string>,
): boolean {
  return (
    unconfigured.has(issue.portal) &&
    isCredentialNotConfiguredError(issue.lastError)
  );
}

/**
 * Split a publication-error list into real per-listing failures and one
 * warning per portal whose credentials are missing workspace-wide.
 * Rows outside the recency window, or with no timestamp, are dropped.
 */
export function summarizePortalSyncIssues(input: {
  issues: PortalPublicationIssue[];
  credentialSamples?: PortalPublicationIssue[];
  credentialCounts?: Readonly<Record<string, number>>;
  unconfiguredPortals: readonly string[];
  now?: Date;
  listLimit?: number;
  sampleLimit?: number;
}): PortalSyncIssueSummary {
  const now = input.now ?? new Date();
  const listLimit = input.listLimit ?? PORTAL_SYNC_ISSUE_LIST_LIMIT;
  const sampleLimit = input.sampleLimit ?? PORTAL_CREDENTIAL_WARNING_SAMPLE;
  const unconfigured = new Set(input.unconfiguredPortals);

  const recentIssues = input.issues.filter((issue) =>
    isRecentPortalSyncIssue(issue.lastSyncAt, now),
  );

  const grouped = new Map<string, PortalPublicationIssue[]>();
  const listingIssues: PortalPublicationIssue[] = [];

  for (const issue of recentIssues) {
    if (isGroupedCredentialIssue(issue, unconfigured)) {
      const bucket = grouped.get(issue.portal) ?? [];
      bucket.push(issue);
      grouped.set(issue.portal, bucket);
      continue;
    }
    listingIssues.push(issue);
  }

  const samplesByPortal = new Map<string, PortalPublicationIssue[]>();
  for (const sample of input.credentialSamples ?? []) {
    if (!isRecentPortalSyncIssue(sample.lastSyncAt, now)) continue;
    if (!isCredentialNotConfiguredError(sample.lastError)) continue;
    if (!unconfigured.has(sample.portal)) continue;
    const bucket = samplesByPortal.get(sample.portal) ?? [];
    bucket.push(sample);
    samplesByPortal.set(sample.portal, bucket);
  }

  const portals = new Set<string>([
    ...grouped.keys(),
    ...samplesByPortal.keys(),
    ...Object.keys(input.credentialCounts ?? {}).filter((portal) =>
      unconfigured.has(portal),
    ),
  ]);

  const warnings: PortalCredentialWarning[] = [];
  for (const portal of portals) {
    const fromList = grouped.get(portal) ?? [];
    const fromSamples = samplesByPortal.get(portal) ?? [];
    const sampleSource = fromSamples.length > 0 ? fromSamples : fromList;
    const counted = input.credentialCounts?.[portal];
    const count = Math.max(counted ?? 0, fromList.length, sampleSource.length);
    if (count <= 0) continue;

    const sample = sampleSource.slice(0, sampleLimit);
    warnings.push({
      portal,
      count,
      sample,
      sampleTruncated: count > sample.length,
    });
  }

  warnings.sort((a, b) => a.portal.localeCompare(b.portal));

  return {
    issues: listingIssues.slice(0, listLimit),
    issuesTruncated: listingIssues.length > listLimit,
    warnings,
  };
}
