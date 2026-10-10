import type { BrochureOrientation } from '~/lib/commercial/brochure-pdf/brochure-document';

export type BrochureStatusRecord = {
  orientation: BrochureOrientation;
  updatedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  publishedMediaId: string | null;
};

export type BrochureStatus =
  | { kind: 'not_created' }
  | { kind: 'draft'; orientation: BrochureOrientation }
  | {
      kind: 'published' | 'edited';
      orientation: BrochureOrientation;
      approvedAt: string;
      approvedByName: string | null;
    };

/**
 * Not created → no saved layout. Draft → never published. Edited since
 * publishing → the layout changed after its approval.
 */
export function brochureStatus(
  records: BrochureStatusRecord[],
): BrochureStatus {
  if (records.length === 0) return { kind: 'not_created' };

  const published = records.find((r) => r.publishedMediaId && r.approvedAt);
  if (!published?.approvedAt) {
    const latest = [...records].sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
    )[0]!;
    return { kind: 'draft', orientation: latest.orientation };
  }

  const edited =
    published.updatedAt != null &&
    new Date(published.updatedAt).getTime() >
      new Date(published.approvedAt).getTime();

  return {
    kind: edited ? 'edited' : 'published',
    orientation: published.orientation,
    approvedAt: published.approvedAt,
    approvedByName: published.approvedByName,
  };
}
