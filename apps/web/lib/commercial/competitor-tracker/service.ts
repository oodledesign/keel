import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  COMPETITOR_CATEGORIES,
  type CompetitorCategory,
  type CompetitorStatus,
  type CompetitorTenure,
  normalizeCompetitorCategory,
  normalizeCompetitorStatus,
  normalizeCompetitorTenure,
  parsePriceToPence,
} from './constants';
import type {
  CompetitorAreaWatch,
  CompetitorCsvImportRow,
  CompetitorListing,
  CompetitorWatchNotification,
  CreateCompetitorListingInput,
  CreateCompetitorWatchInput,
  UpdateCompetitorListingInput,
  UpdateCompetitorWatchInput,
} from './types';

export type {
  CompetitorAreaWatch,
  CompetitorCsvImportRow,
  CompetitorListing,
  CompetitorWatchNotification,
  CreateCompetitorListingInput,
  CreateCompetitorWatchInput,
  UpdateCompetitorListingInput,
  UpdateCompetitorWatchInput,
} from './types';

type ListingRow = Record<string, unknown> & {
  id: string;
  account_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  first_seen_at: string;
};

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapListing(row: ListingRow): CompetitorListing {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    locationText: (row.location_text as string | null) ?? null,
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    sizeSqft: asNumber(row.size_sqft),
    sizeMinSqft: asNumber(row.size_min_sqft),
    sizeMaxSqft: asNumber(row.size_max_sqft),
    pricePence: asNumber(row.price_pence),
    tenure: normalizeCompetitorTenure(
      (row.tenure as string | null) ?? null,
    ) as CompetitorTenure | null,
    competitorAgent: (row.competitor_agent as string | null) ?? null,
    category: normalizeCompetitorCategory(
      (row.category as string | null) ?? 'industrial',
    ),
    status: normalizeCompetitorStatus(
      (row.status as string | null) ?? 'watching',
    ),
    sourceUrl: (row.source_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    firstSeenAt: row.first_seen_at,
    lastCheckedAt: (row.last_checked_at as string | null) ?? null,
    priceChangedAt: (row.price_changed_at as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWatch(row: Record<string, unknown>): CompetitorAreaWatch {
  const categories = Array.isArray(row.categories)
    ? (row.categories as string[])
        .map((c) => normalizeCompetitorCategory(c))
        .filter((c, i, arr) => arr.indexOf(c) === i)
    : [...COMPETITOR_CATEGORIES];

  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name),
    towns: Array.isArray(row.towns) ? (row.towns as string[]) : [],
    postcodePrefixes: Array.isArray(row.postcode_prefixes)
      ? (row.postcode_prefixes as string[])
      : [],
    categories: categories.length > 0 ? categories : [...COMPETITOR_CATEGORIES],
    sizeMinSqft: asNumber(row.size_min_sqft),
    sizeMaxSqft: asNumber(row.size_max_sqft),
    notifyOnNew: row.notify_on_new !== false,
    notifyOnPriceChange: row.notify_on_price_change !== false,
    enabled: row.enabled !== false,
    lastRunAt: (row.last_run_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const LISTING_SELECT =
  'id, account_id, name, location_text, town, postcode, size_sqft, size_min_sqft, size_max_sqft, price_pence, tenure, competitor_agent, category, status, source_url, notes, metadata, first_seen_at, last_checked_at, price_changed_at, archived_at, created_at, updated_at';

export function createCompetitorTrackerService(client: SupabaseClient) {
  return new CompetitorTrackerService(client);
}

class CompetitorTrackerService {
  constructor(private readonly client: SupabaseClient) {}

  async listListings(
    accountId: string,
    filters?: {
      category?: CompetitorCategory | null;
      status?: CompetitorStatus | null;
      query?: string | null;
      includeArchived?: boolean;
    },
  ): Promise<CompetitorListing[]> {
    let query = this.client
      .from('competitor_listings')
      .select(LISTING_SELECT)
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false });

    if (!filters?.includeArchived) {
      query = query.is('archived_at', null);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.query?.trim()) {
      const term = `%${filters.query.trim()}%`;
      query = query.or(
        `name.ilike.${term},location_text.ilike.${term},town.ilike.${term},postcode.ilike.${term},competitor_agent.ilike.${term}`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as ListingRow[]).map(mapListing);
  }

  async createListing(
    input: CreateCompetitorListingInput,
  ): Promise<CompetitorListing> {
    const name = input.name.trim();
    if (!name) throw new Error('Property name is required');

    const payload = {
      account_id: input.accountId,
      name,
      location_text: input.locationText?.trim() || null,
      town: input.town?.trim() || null,
      postcode: input.postcode?.trim() || null,
      size_sqft: input.sizeSqft ?? null,
      size_min_sqft: input.sizeMinSqft ?? null,
      size_max_sqft: input.sizeMaxSqft ?? null,
      price_pence: input.pricePence ?? null,
      tenure: input.tenure ?? null,
      competitor_agent: input.competitorAgent?.trim() || null,
      category: input.category ?? 'industrial',
      status: input.status ?? 'watching',
      source_url: input.sourceUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      metadata: input.metadata ?? {},
      created_by: input.createdBy ?? null,
      last_checked_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('competitor_listings')
      .insert(payload)
      .select(LISTING_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return mapListing(data as ListingRow);
  }

  async updateListing(
    input: UpdateCompetitorListingInput,
  ): Promise<CompetitorListing> {
    const { data: existing, error: loadError } = await this.client
      .from('competitor_listings')
      .select('price_pence')
      .eq('id', input.listingId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);
    if (!existing) throw new Error('Listing not found');

    const updates: Record<string, unknown> = {
      last_checked_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('Property name is required');
      updates.name = name;
    }
    if (input.locationText !== undefined) {
      updates.location_text = input.locationText?.trim() || null;
    }
    if (input.town !== undefined) updates.town = input.town?.trim() || null;
    if (input.postcode !== undefined) {
      updates.postcode = input.postcode?.trim() || null;
    }
    if (input.sizeSqft !== undefined) updates.size_sqft = input.sizeSqft;
    if (input.sizeMinSqft !== undefined) {
      updates.size_min_sqft = input.sizeMinSqft;
    }
    if (input.sizeMaxSqft !== undefined) {
      updates.size_max_sqft = input.sizeMaxSqft;
    }
    if (input.pricePence !== undefined) {
      updates.price_pence = input.pricePence;
      const previous = asNumber(
        (existing as { price_pence?: number | null }).price_pence,
      );
      if (
        input.pricePence != null &&
        previous != null &&
        input.pricePence !== previous
      ) {
        updates.price_changed_at = new Date().toISOString();
      }
    }
    if (input.tenure !== undefined) updates.tenure = input.tenure;
    if (input.competitorAgent !== undefined) {
      updates.competitor_agent = input.competitorAgent?.trim() || null;
    }
    if (input.category !== undefined) updates.category = input.category;
    if (input.status !== undefined) updates.status = input.status;
    if (input.sourceUrl !== undefined) {
      updates.source_url = input.sourceUrl?.trim() || null;
    }
    if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    const { data, error } = await this.client
      .from('competitor_listings')
      .update(updates)
      .eq('id', input.listingId)
      .eq('account_id', input.accountId)
      .select(LISTING_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return mapListing(data as ListingRow);
  }

  async archiveListing(listingId: string, accountId: string): Promise<void> {
    const { error } = await this.client
      .from('competitor_listings')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', listingId)
      .eq('account_id', accountId);
    if (error) throw new Error(error.message);
  }

  async upsertBySourceUrl(
    input: CreateCompetitorListingInput,
  ): Promise<{ listing: CompetitorListing; created: boolean }> {
    const sourceUrl = input.sourceUrl?.trim() || null;
    if (!sourceUrl) {
      return {
        listing: await this.createListing(input),
        created: true,
      };
    }

    const { data: existing } = await this.client
      .from('competitor_listings')
      .select('id')
      .eq('account_id', input.accountId)
      .eq('source_url', sourceUrl)
      .is('archived_at', null)
      .maybeSingle();

    if (existing?.id) {
      const listing = await this.updateListing({
        listingId: existing.id as string,
        accountId: input.accountId,
        name: input.name,
        locationText: input.locationText,
        town: input.town,
        postcode: input.postcode,
        sizeSqft: input.sizeSqft,
        sizeMinSqft: input.sizeMinSqft,
        sizeMaxSqft: input.sizeMaxSqft,
        pricePence: input.pricePence,
        tenure: input.tenure,
        competitorAgent: input.competitorAgent,
        category: input.category,
        status: input.status,
        notes: input.notes,
        metadata: input.metadata,
      });
      return { listing, created: false };
    }

    return {
      listing: await this.createListing(input),
      created: true,
    };
  }

  async importCsvRows(
    accountId: string,
    rows: CompetitorCsvImportRow[],
    createdBy?: string | null,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      try {
        const result = await this.upsertBySourceUrl({
          accountId,
          name: row.name,
          locationText: row.locationText,
          town: row.town,
          postcode: row.postcode,
          sizeSqft: row.sizeSqft,
          pricePence: row.pricePence,
          tenure: row.tenure,
          competitorAgent: row.competitorAgent,
          category: row.category,
          status: row.status,
          sourceUrl: row.sourceUrl,
          notes: row.notes,
          createdBy,
          metadata: { import: 'csv', row: i + 1 },
        });
        if (result.created) created += 1;
        else updated += 1;
      } catch (error) {
        errors.push(
          `Row ${i + 1}: ${error instanceof Error ? error.message : 'Failed'}`,
        );
      }
    }

    return { created, updated, errors };
  }

  async listWatches(accountId: string): Promise<CompetitorAreaWatch[]> {
    const { data, error } = await this.client
      .from('competitor_area_watches')
      .select('*')
      .eq('account_id', accountId)
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapWatch(row as Record<string, unknown>));
  }

  async createWatch(
    input: CreateCompetitorWatchInput,
  ): Promise<CompetitorAreaWatch> {
    const name = input.name.trim();
    if (!name) throw new Error('Watch name is required');

    const { data, error } = await this.client
      .from('competitor_area_watches')
      .insert({
        account_id: input.accountId,
        name,
        towns: input.towns ?? [],
        postcode_prefixes: input.postcodePrefixes ?? [],
        categories: input.categories ?? [...COMPETITOR_CATEGORIES],
        size_min_sqft: input.sizeMinSqft ?? null,
        size_max_sqft: input.sizeMaxSqft ?? null,
        notify_on_new: input.notifyOnNew ?? true,
        notify_on_price_change: input.notifyOnPriceChange ?? true,
        enabled: input.enabled ?? true,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapWatch(data as Record<string, unknown>);
  }

  async updateWatch(
    input: UpdateCompetitorWatchInput,
  ): Promise<CompetitorAreaWatch> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('Watch name is required');
      updates.name = name;
    }
    if (input.towns !== undefined) updates.towns = input.towns;
    if (input.postcodePrefixes !== undefined) {
      updates.postcode_prefixes = input.postcodePrefixes;
    }
    if (input.categories !== undefined) updates.categories = input.categories;
    if (input.sizeMinSqft !== undefined) {
      updates.size_min_sqft = input.sizeMinSqft;
    }
    if (input.sizeMaxSqft !== undefined) {
      updates.size_max_sqft = input.sizeMaxSqft;
    }
    if (input.notifyOnNew !== undefined) {
      updates.notify_on_new = input.notifyOnNew;
    }
    if (input.notifyOnPriceChange !== undefined) {
      updates.notify_on_price_change = input.notifyOnPriceChange;
    }
    if (input.enabled !== undefined) updates.enabled = input.enabled;

    const { data, error } = await this.client
      .from('competitor_area_watches')
      .update(updates)
      .eq('id', input.watchId)
      .eq('account_id', input.accountId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapWatch(data as Record<string, unknown>);
  }

  async deleteWatch(watchId: string, accountId: string): Promise<void> {
    const { error } = await this.client
      .from('competitor_area_watches')
      .delete()
      .eq('id', watchId)
      .eq('account_id', accountId);
    if (error) throw new Error(error.message);
  }

  async listNotifications(
    accountId: string,
    limit = 30,
  ): Promise<CompetitorWatchNotification[]> {
    const { data, error } = await this.client
      .from('competitor_watch_notifications')
      .select(
        'id, account_id, watch_id, listing_id, event_type, summary, read_at, created_at, competitor_listings(name), competitor_area_watches(name)',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const listingJoin = row.competitor_listings as
        | { name?: string }
        | { name?: string }[]
        | null;
      const watchJoin = row.competitor_area_watches as
        | { name?: string }
        | { name?: string }[]
        | null;
      const listingName = Array.isArray(listingJoin)
        ? (listingJoin[0]?.name ?? null)
        : (listingJoin?.name ?? null);
      const watchName = Array.isArray(watchJoin)
        ? (watchJoin[0]?.name ?? null)
        : (watchJoin?.name ?? null);

      return {
        id: String(row.id),
        accountId: String(row.account_id),
        watchId: String(row.watch_id),
        listingId: String(row.listing_id),
        eventType: row.event_type as 'new' | 'price_changed',
        summary: String(row.summary),
        readAt: (row.read_at as string | null) ?? null,
        createdAt: String(row.created_at),
        listingName,
        watchName,
      };
    });
  }

  async markNotificationsRead(
    accountId: string,
    notificationIds?: string[],
  ): Promise<void> {
    let query = this.client
      .from('competitor_watch_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .is('read_at', null);

    if (notificationIds?.length) {
      query = query.in('id', notificationIds);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
  }
}

export function parseCompetitorCsv(text: string): CompetitorCsvImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const split = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const header = split(lines[0]!).map((h) => h.toLowerCase());
  const col = (...names: string[]) => {
    for (const name of names) {
      const idx = header.findIndex(
        (h) => h === name || h.includes(name) || name.includes(h),
      );
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const nameIdx = col('name', 'property', 'address', 'title');
  const locationIdx = col('location', 'area', 'town');
  const postcodeIdx = col('postcode', 'post code');
  const sizeIdx = col('size', 'sqft', 'sq ft', 'area sqft');
  const priceIdx = col('price', 'rent', 'asking');
  const agentIdx = col('agent', 'competitor', 'agency');
  const categoryIdx = col('category', 'type', 'sector');
  const statusIdx = col('status');
  const tenureIdx = col('tenure', 'sale', 'to let');
  const urlIdx = col('url', 'link', 'source', 'rightmove');
  const notesIdx = col('notes', 'comment');

  if (nameIdx < 0) {
    throw new Error(
      'CSV needs a name/property/address column in the header row',
    );
  }

  const rows: CompetitorCsvImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]!);
    const name = cells[nameIdx]?.trim() ?? '';
    if (!name) continue;

    const locationRaw =
      locationIdx >= 0 ? (cells[locationIdx]?.trim() ?? '') : '';
    const postcode = postcodeIdx >= 0 ? (cells[postcodeIdx]?.trim() ?? '') : '';
    const sizeRaw = sizeIdx >= 0 ? (cells[sizeIdx]?.trim() ?? '') : '';
    const sizeNum = sizeRaw
      ? Number(sizeRaw.replace(/,/g, '').replace(/sq\.?\s*ft/i, ''))
      : null;

    rows.push({
      name,
      locationText: locationRaw || null,
      town: locationRaw || null,
      postcode: postcode || null,
      sizeSqft: Number.isFinite(sizeNum) ? sizeNum : null,
      pricePence:
        priceIdx >= 0 ? parsePriceToPence(cells[priceIdx] ?? '') : null,
      competitorAgent: agentIdx >= 0 ? cells[agentIdx]?.trim() || null : null,
      category:
        categoryIdx >= 0
          ? normalizeCompetitorCategory(cells[categoryIdx])
          : 'industrial',
      status:
        statusIdx >= 0
          ? normalizeCompetitorStatus(cells[statusIdx])
          : 'watching',
      tenure:
        tenureIdx >= 0 ? normalizeCompetitorTenure(cells[tenureIdx]) : null,
      sourceUrl: urlIdx >= 0 ? cells[urlIdx]?.trim() || null : null,
      notes: notesIdx >= 0 ? cells[notesIdx]?.trim() || null : null,
    });
  }

  return rows;
}
