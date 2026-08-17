import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildBrochureDocument } from '~/lib/commercial/brochure-pdf/build-brochure-document';
import type {
  BrochureDocument,
  BrochureOrientation,
  BrochurePage,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
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
};

function mapRow(row: BrochureRow): BrochureDocument & { id: string } {
  return {
    id: row.id,
    listingId: row.listing_id,
    templateId: row.template_id as BrochureTemplateId,
    pageSize: 'A4',
    orientation: row.orientation as BrochureOrientation,
    pages: (Array.isArray(row.pages) ? row.pages : []) as BrochurePage[],
    updatedAt: row.updated_at,
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
  ): Promise<(BrochureDocument & { id: string }) | null> {
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
  }): Promise<BrochureDocument & { id: string }> {
    const existing = await this.getDocument(
      input.listingId,
      input.accountId,
      input.orientation,
    );
    if (existing) return existing;

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
  }): Promise<BrochureDocument & { id: string }> {
    const data = await loadListingBrochureData(
      input.listingId,
      input.accountId,
    );
    if (!data) throw new Error('Listing not found');

    const built = buildBrochureDocument(data, {
      orientation: input.orientation,
      templateId: input.templateId,
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
  }): Promise<BrochureDocument & { id: string }> {
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
  }): Promise<BrochureDocument & { id: string }> {
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
}
