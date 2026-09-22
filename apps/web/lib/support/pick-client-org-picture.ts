import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export type ClientPictureCandidate = {
  clientOrgId: string | null | undefined;
  pictureUrl: string | null | undefined;
  clientType?: string | null;
  updatedAt?: string | null;
};

function rank(row: ClientPictureCandidate) {
  const business = row.clientType === 'business' ? 1 : 0;
  const updated = row.updatedAt ? Date.parse(row.updatedAt) : 0;
  return { business, updated: Number.isFinite(updated) ? updated : 0 };
}

/**
 * Best public logo per client org. Business clients win over individuals;
 * otherwise the most recently updated picture.
 */
export function pickClientOrgPictures(
  rows: ClientPictureCandidate[],
): Map<string, string> {
  const grouped = new Map<string, ClientPictureCandidate[]>();

  for (const row of rows) {
    const orgId = row.clientOrgId?.trim();
    const picture = row.pictureUrl?.trim();
    if (!orgId || !picture) continue;
    const list = grouped.get(orgId) ?? [];
    list.push(row);
    grouped.set(orgId, list);
  }

  const map = new Map<string, string>();

  for (const [orgId, list] of grouped) {
    const sorted = [...list].sort((a, b) => {
      const left = rank(a);
      const right = rank(b);
      if (left.business !== right.business) {
        return right.business - left.business;
      }
      return right.updated - left.updated;
    });
    const url = toSupabasePublicStorageUrl(sorted[0]?.pictureUrl);
    if (url) map.set(orgId, url);
  }

  return map;
}
