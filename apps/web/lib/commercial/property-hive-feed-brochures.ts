import type { PropertyHiveFeedFile } from '~/lib/commercial/property-hive-feed-media';

export type FeedBrochureDocumentRow = {
  listingId: string;
  orientation: string;
  templateId: string;
  pages: unknown;
  updatedAt: string;
};

export function brochureDocumentHasPages(pages: unknown): boolean {
  return Array.isArray(pages) && pages.length > 0;
}

/** Latest saved brochure with pages. Portrait is not preferred over a newer edit. */
export function pickFeedBrochureDocument(
  rows: readonly FeedBrochureDocumentRow[],
): FeedBrochureDocumentRow | null {
  const ready = rows.filter((row) => brochureDocumentHasPages(row.pages));
  ready.sort((a, b) => {
    if (a.updatedAt === b.updatedAt) return 0;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
  return ready[0] ?? null;
}

/**
 * The online brochure (saved document or public share) is not a media row.
 * Property Hive only imports brochures from `<files>`.
 */
export function shouldPublishOzerBrochureToFeed(input: {
  shareEnabled: boolean;
  documents: readonly Pick<FeedBrochureDocumentRow, 'pages'>[];
}): boolean {
  return (
    input.shareEnabled ||
    input.documents.some((row) => brochureDocumentHasPages(row.pages))
  );
}

export function ozerBrochureFeedVersion(input: {
  documentUpdatedAt: string | null;
  listingUpdatedAt: string | null;
}): string {
  const raw = input.documentUpdatedAt || input.listingUpdatedAt || 'brochure';
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '');
  return (cleaned || 'brochure').slice(0, 32);
}

export function buildOzerBrochureFeedFile(input: {
  siteUrl: string;
  listingId: string;
  version: string;
}): PropertyHiveFeedFile {
  const base = input.siteUrl.replace(/\/+$/, '');
  const version =
    input.version.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || 'brochure';
  const name = `brochure-v${version}.pdf`;
  return {
    name,
    url: `${base}/api/commercial/listing-brochure/${input.listingId}/${name}`,
    type: '11',
    mediaType: 'brochure',
  };
}

/** Keep an uploaded brochure. Add the generated PDF only when none was uploaded. */
export function withOzerBrochureFeedFile(
  files: readonly PropertyHiveFeedFile[],
  brochure: PropertyHiveFeedFile | null,
): PropertyHiveFeedFile[] {
  if (!brochure) return [...files];
  if (files.some((file) => file.mediaType === 'brochure')) return [...files];
  return [...files, brochure];
}
