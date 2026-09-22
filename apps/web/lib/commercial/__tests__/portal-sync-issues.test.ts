import { describe, expect, it } from 'vitest';

import {
  type PortalPublicationIssue,
  formatPortalSyncIssueTime,
  isRecentPortalSyncIssue,
  portalCredentialWarningMessage,
  propertyHiveLocalUnpublishRecord,
  summarizePortalSyncIssues,
} from '../portal-sync-issues';

const NOW = new Date('2026-09-22T12:00:00.000Z');

function issue(
  overrides: Partial<PortalPublicationIssue> &
    Pick<PortalPublicationIssue, 'id'>,
): PortalPublicationIssue {
  return {
    listingId: overrides.id,
    listingName: 'Tong Farm',
    portal: 'property_hive',
    status: 'unpublished',
    lastSyncAt: '2026-09-20T12:00:00.000Z',
    lastError:
      'Property Hive credentials not configured; marked unpublished locally',
    ...overrides,
  };
}

describe('summarizePortalSyncIssues', () => {
  it('groups identical missing-credential rows when the portal is unconfigured', () => {
    const summary = summarizePortalSyncIssues({
      now: NOW,
      unconfiguredPortals: ['property_hive'],
      issues: [
        issue({ id: '1', listingName: 'Tong Farm' }),
        issue({ id: '2', listingName: 'Railway Approach' }),
        issue({
          id: '3',
          portal: 'rightmove',
          status: 'error',
          listingName: 'High Street',
          lastError: 'Rightmove rejected the branch id',
        }),
      ],
    });

    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]?.portal).toBe('property_hive');
    expect(summary.warnings[0]?.count).toBe(2);
    expect(summary.issues.map((row) => row.id)).toEqual(['3']);
    expect(portalCredentialWarningMessage('property_hive', 2)).toMatch(
      /XML feed/,
    );
  });

  it('keeps credential errors when that portal is configured', () => {
    const summary = summarizePortalSyncIssues({
      now: NOW,
      unconfiguredPortals: [],
      issues: [issue({ id: '1' })],
    });

    expect(summary.warnings).toHaveLength(0);
    expect(summary.issues).toHaveLength(1);
  });

  it('drops rows with no timestamp or outside the 30 day window', () => {
    const summary = summarizePortalSyncIssues({
      now: NOW,
      unconfiguredPortals: [],
      issues: [
        issue({
          id: 'old',
          portal: 'rightmove',
          lastError: 'Timeout',
          lastSyncAt: '2026-01-01T00:00:00.000Z',
        }),
        issue({
          id: 'undated',
          portal: 'each',
          lastError: 'EACH feed failed',
          lastSyncAt: null,
        }),
        issue({
          id: 'recent',
          portal: 'each',
          lastError: 'EACH feed failed',
          lastSyncAt: '2026-09-21T12:00:00.000Z',
        }),
      ],
    });

    expect(summary.issues.map((row) => row.id)).toEqual(['recent']);
    expect(isRecentPortalSyncIssue(null, NOW)).toBe(false);
  });

  it('uses the database count when it is higher than the loaded sample', () => {
    const summary = summarizePortalSyncIssues({
      now: NOW,
      unconfiguredPortals: ['property_hive'],
      issues: [],
      credentialCounts: { property_hive: 48 },
      credentialSamples: [issue({ id: '1', listingName: 'Tong Farm' })],
    });

    expect(summary.warnings[0]?.count).toBe(48);
    expect(summary.warnings[0]?.sample).toHaveLength(1);
    expect(summary.warnings[0]?.sampleTruncated).toBe(true);
    expect(summary.issues).toHaveLength(0);
  });

  it('caps the per-listing list and flags truncation', () => {
    const summary = summarizePortalSyncIssues({
      now: NOW,
      listLimit: 2,
      unconfiguredPortals: [],
      issues: [
        issue({ id: '1', portal: 'rightmove', lastError: 'A' }),
        issue({ id: '2', portal: 'rightmove', lastError: 'B' }),
        issue({ id: '3', portal: 'rightmove', lastError: 'C' }),
      ],
    });

    expect(summary.issues.map((row) => row.id)).toEqual(['1', '2']);
    expect(summary.issuesTruncated).toBe(true);
  });
});

describe('propertyHiveLocalUnpublishRecord', () => {
  it('does not store a credentials error on a local unpublish', () => {
    expect(propertyHiveLocalUnpublishRecord()).toEqual({
      status: 'unpublished',
      lastError: null,
    });
  });
});

describe('formatPortalSyncIssueTime', () => {
  it('formats relative times inside a week and a date after that', () => {
    expect(formatPortalSyncIssueTime('2026-09-22T11:30:00.000Z', NOW)).toBe(
      '30m ago',
    );
    expect(formatPortalSyncIssueTime('2026-09-21T12:00:00.000Z', NOW)).toBe(
      'Yesterday',
    );
    expect(formatPortalSyncIssueTime('2026-09-19T12:00:00.000Z', NOW)).toBe(
      '3d ago',
    );
    expect(formatPortalSyncIssueTime('2026-08-01T12:00:00.000Z', NOW)).toBe(
      '1 Aug',
    );
    expect(formatPortalSyncIssueTime('2025-08-01T12:00:00.000Z', NOW)).toBe(
      '1 Aug 2025',
    );
    expect(formatPortalSyncIssueTime('not-a-date', NOW)).toBe('');
  });
});
