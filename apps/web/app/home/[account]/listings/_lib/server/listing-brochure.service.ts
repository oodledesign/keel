import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  BrochureDisplayOptions,
  BrochureDocument,
  BrochureOrientation,
  BrochurePage,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { buildBrochureDocument } from '~/lib/commercial/brochure-pdf/build-brochure-document';
import { hydrateBrochureDocument } from '~/lib/commercial/brochure-pdf/hydrate-brochure-document';
import { loadListingBrochureData } from '~/lib/commercial/brochure-pdf/load-listing-brochure-data';

type BrochureRow = {
  id: string;
  account_id: string;
  listing_id: string;
  template_id: string;
  page_size: string;
  orientation: string;
  pages: unknown;
  storage_path: string | null;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  published_media_id: string | null;
};

export type ListingBrochureRecord = BrochureDocument & {
  id: string;
  approvedAt: string | null;
  approvedBy: string | null;
  publishedMediaId: string | null;
};

function mapRow(row: BrochureRow): ListingBrochureRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    templateId: row.template_id as BrochureTemplateId,
    pageSize: 'A4',
    orientation: row.orientation as BrochureOrientation,
    pages: (Array.isArray(row.pages) ? row.pages : []) as BrochurePage[],
    updatedAt: row.updated_at,
    approvedAt: row.approved_at ?? null,
    approvedBy: row.approved_by ?? null,
    publishedMediaId: row.published_media_id ?? null,
  };
}

export function createListingBrochureService(client: SupabaseClient) {
  return new ListingBrochureService(client);
}

class ListingBrochureService {
  constructor(private readonly client: SupabaseClient) {}

  async getDocument(
    listingId: string,
    accountId: string,
    orientation: BrochureOrientation,
  ): Promise<ListingBrochureRecord | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client as any)
      .from('commercial_listing_brochures')
      .select('*')
      .eq('listing_id', listingId)
      .eq('account_id', accountId)
      .eq('orientation', orientation)
      .maybeSingle();

    if (error) {
      console.error('[brochure] getDocument error:', error.message);
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapRow(data as BrochureRow);
  }

  async getOrCreateDocument(input: {
    listingId: string;
    accountId: string;
    orientation: BrochureOrientation;
    templateId?: BrochureTemplateId;
  }): Promise<ListingBrochureRecord> {
    const existing = await this.getDocument(
      input.listingId,
      input.accountId,
      input.orientation,
    );
    if (existing) {
      const data = await loadListingBrochureData(
        input.listingId,
        input.accountId,
      );
      if (!data) return existing;
      return { ...existing, ...hydrateBrochureDocument(existing, data) };
    }

    const data = await loadListingBrochureData(
      input.listingId,
      input.accountId,
    );
    if (!data) throw new Error('Listing not found');

    const templateId = input.templateId ?? 'classic';
    const built = buildBrochureDocument(data, {
      orientation: input.orientation,
      templateId,
    });

    return this.upsertDocument({
      listingId: input.listingId,
      accountId: input.accountId,
      document: built,
    });
  }

  async regenerateFromTemplate(input: {
    listingId: string;
    accountId: string;
    orientation: BrochureOrientation;
    templateId: BrochureTemplateId;
    display?: Partial<BrochureDisplayOptions>;
  }): Promise<ListingBrochureRecord> {
    const data = await loadListingBrochureData(
      input.listingId,
      input.accountId,
    );
    if (!data) throw new Error('Listing not found');

    const built = buildBrochureDocument(data, {
      orientation: input.orientation,
      templateId: input.templateId,
      display: input.display,
    });

    return this.upsertDocument({
      listingId: input.listingId,
      accountId: input.accountId,
      document: built,
    });
  }

  async upsertDocument(input: {
    listingId: string;
    accountId: string;
    document: BrochureDocument;
  }): Promise<ListingBrochureRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client as any)
      .from('commercial_listing_brochures')
      .upsert(
        {
          account_id: input.accountId,
          listing_id: input.listingId,
          template_id: input.document.templateId,
          page_size: 'A4',
          orientation: input.document.orientation,
          pages: input.document.pages,
          storage_path: null,
        },
        { onConflict: 'listing_id,orientation' },
      )
      .select('*')
      .single();

    if (error) {
      console.error('[brochure] upsert error:', error.message);
      throw new Error(error.message ?? 'Failed to save brochure');
    }

    return mapRow(data as BrochureRow);
  }

  async savePages(input: {
    listingId: string;
    accountId: string;
    orientation: BrochureOrientation;
    templateId: BrochureTemplateId;
    pages: BrochurePage[];
  }): Promise<ListingBrochureRecord> {
    return this.upsertDocument({
      listingId: input.listingId,
      accountId: input.accountId,
      document: {
        listingId: input.listingId,
        templateId: input.templateId,
        pageSize: 'A4',
        orientation: input.orientation,
        pages: input.pages,
      },
    });
  }

  /** Every saved brochure for the listing (one per orientation). */
  async listDocuments(
    listingId: string,
    accountId: string,
  ): Promise<ListingBrochureRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client as any)
      .from('commercial_listing_brochures')
      .select('*')
      .eq('listing_id', listingId)
      .eq('account_id', accountId);

    if (error) {
      console.error('[brochure] listDocuments error:', error.message);
      throw new Error(error.message);
    }
    return ((data ?? []) as BrochureRow[]).map(mapRow);
  }

  /**
   * Marks `orientation` as the listing's approved, published brochure and
   * detaches any earlier published PDF (either orientation) so the listing
   * only ever feeds one. Returns the media ids that are no longer published.
   */
  async recordPublished(input: {
    listingId: string;
    accountId: string;
    orientation: BrochureOrientation;
    mediaId: string;
    userId: string;
  }): Promise<string[]> {
    const docs = await this.listDocuments(input.listingId, input.accountId);
    const previous = docs
      .map((doc) => doc.publishedMediaId)
      .filter((id): id is string => Boolean(id) && id !== input.mediaId);

    const table = () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.client as any).from('commercial_listing_brochures');

    const { error } = await table()
      .update({
        approved_at: new Date().toISOString(),
        approved_by: input.userId,
        published_media_id: input.mediaId,
      })
      .eq('listing_id', input.listingId)
      .eq('account_id', input.accountId)
      .eq('orientation', input.orientation);
    if (error) {
      console.error('[brochure] recordPublished error:', error.message);
      throw new Error(error.message);
    }

    const { error: detachError } = await table()
      .update({ published_media_id: null })
      .eq('listing_id', input.listingId)
      .eq('account_id', input.accountId)
      .neq('orientation', input.orientation)
      .not('published_media_id', 'is', null);
    if (detachError) {
      console.error('[brochure] detach published error:', detachError.message);
    }

    return previous;
  }
}
