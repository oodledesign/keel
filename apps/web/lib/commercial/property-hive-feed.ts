import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type DisposalType,
  disposalIncludesForSale,
  disposalIncludesToLet,
} from '~/lib/commercial/commercial-constants';

const FEED_TOKEN_META_KEY = 'xml_feed_token';

/** Portals that pull the Kato-compatible listing XML feed. */
export type CommercialXmlFeedPortal = 'property_hive' | 'each';

const FEED_PATH: Record<CommercialXmlFeedPortal, string> = {
  property_hive: '/api/commercial/property-hive-feed',
  each: '/api/commercial/each-feed',
};
const MEDIA_BUCKET = 'commercial-listing-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — PH fetches during import

const ON_MARKET_STATUSES = new Set(['marketing', 'under_offer']);

type ListingRow = {
  id: string;
  account_id: string;
  external_id: string | null;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  sector: string | null;
  tenure: string | null;
  disposal_type: string;
  status: string;
  asking_rent_pence: number | null;
  asking_rent_to_pence: number | null;
  asking_price_pence: number | null;
  rent_frequency: string | null;
  hide_rent_from_marketing: boolean;
  hide_price_from_marketing: boolean;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
  measurement_standard: string | null;
  use_class: string | null;
  available_from: string | null;
  epc_band: string | null;
  epc_rating: number | null;
  summary: string | null;
  description: string | null;
  location_copy: string | null;
  key_points: unknown;
  on_market_at: string | null;
  created_at: string;
  updated_at: string;
};

type UnitRow = {
  id: string;
  listing_id: string;
  external_id: string | null;
  label: string;
  floor_or_unit: string | null;
  size_sqft: number | null;
  sort_order: number;
};

type MediaRow = {
  id: string;
  listing_id: string;
  media_type: string;
  storage_path: string | null;
  external_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  sort_order: number;
};

type CoAgentFeedRow = {
  listing_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  clients:
    | {
        display_name: string | null;
        company_name: string | null;
        email: string | null;
        phone: string | null;
      }
    | {
        display_name: string | null;
        company_name: string | null;
        email: string | null;
        phone: string | null;
      }[]
    | null;
};

function adminDb(): SupabaseClient {
  return getSupabaseServerAdminClient() as unknown as SupabaseClient;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function el(name: string, value: string | number | null | undefined): string {
  if (value == null || value === '') return `<${name}/>`;
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function elRaw(name: string, inner: string): string {
  if (!inner) return `<${name}/>`;
  return `<${name}>${inner}</${name}>`;
}

function penceToPounds(pence: number | null): number | null {
  if (pence == null) return null;
  return Math.round(pence) / 100;
}

function formatMoneyLabel(pounds: number, suffix: string): string {
  return `£${pounds.toLocaleString('en-GB', { maximumFractionDigits: 0 })} ${suffix}`;
}

function mapStatus(status: string): string {
  switch (status) {
    case 'under_offer':
      return 'Under Offer';
    case 'let':
      return 'Let';
    case 'sold':
      return 'Sold';
    case 'withdrawn':
      return 'Withdrawn';
    case 'marketing':
    case 'instructed':
    default:
      return 'Available';
  }
}

function mapAvailability(disposalType: string): string {
  if (disposalType === 'to_let_and_for_sale') return 'To Let & For Sale';
  return disposalType === 'to_let' ? 'To Let' : 'For Sale';
}

function renderAvailabilities(disposalType: DisposalType): string {
  const includesLet = disposalIncludesToLet(disposalType);
  const includesSale = disposalIncludesForSale(disposalType);
  const types: string[] = [];
  if (includesLet) {
    types.push(`<type id="tolet">To Let</type>`);
  }
  if (includesSale) {
    types.push(`<type id="forsale">For Sale</type>`);
  }
  if (!types.length) {
    types.push(
      `<type id="${disposalType === 'to_let' ? 'tolet' : 'forsale'}">${escapeXml(mapAvailability(disposalType))}</type>`,
    );
  }
  return `<availabilities>${types.join('')}</availabilities>`;
}

function mapSizeMeasure(standard: string | null): string {
  switch ((standard ?? 'gia').toLowerCase()) {
    case 'nia':
      return 'Net Internal Area';
    case 'gea':
      return 'Gross External Area';
    case 'ipms':
      return 'IPMS';
    default:
      return 'Gross Internal Area';
  }
}

function keyPoints(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'text' in item) {
        return String((item as { text: unknown }).text ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function feedPropertyId(listing: ListingRow): string {
  return listing.external_id?.trim() || listing.id;
}

function sqlTimestamp(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  // Kato style: 2023-10-02 12:17:23
  return d
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '');
}

async function resolveMediaUrl(
  client: SupabaseClient,
  media: MediaRow,
): Promise<string | null> {
  if (media.external_url) return media.external_url;
  if (!media.storage_path) return null;

  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(media.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error('[property-hive-feed] signed url error:', error.message);
    return null;
  }

  return data.signedUrl;
}

function renderFloorUnits(
  units: UnitRow[],
  includesToLet: boolean,
  includesForSale: boolean,
): string {
  if (!units.length) return '<floor_units/>';

  const items = units
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((unit) => {
      const size =
        unit.size_sqft != null
          ? String(Math.round(Number(unit.size_sqft)))
          : '';
      const sizeLabel =
        unit.size_sqft != null
          ? Number(unit.size_sqft).toLocaleString('en-GB')
          : '';

      return [
        '<floor_unit>',
        el('meta_id', unit.external_id ?? unit.id),
        el('floorunit', unit.floor_or_unit ?? ''),
        el('description', unit.label),
        el('size', size),
        el('size_metric', 'sqft'),
        el('size_sqft', sizeLabel),
        el('rent_available', includesToLet ? 't' : 'f'),
        '<rent_prefix/>',
        '<rent_price/>',
        '<rent_metric/>',
        '<rent_suffix/>',
        '<rent_sqft/>',
        el('freehold_available', includesForSale ? 't' : 'f'),
        '<freehold_prefix/>',
        '<freehold_price/>',
        '<freehold_metric/>',
        '<freehold_suffix/>',
        el('leasehold_available', 'f'),
        '<leasehold_prefix/>',
        '<leasehold_price/>',
        '<leasehold_metric/>',
        '<leasehold_suffix/>',
        el('status', 'Available'),
        '</floor_unit>',
      ].join('');
    })
    .join('');

  return `<floor_units>${items}</floor_units>`;
}

async function renderPropertyXml(
  client: SupabaseClient,
  listing: ListingRow,
  units: UnitRow[],
  media: MediaRow[],
  coAgents: CoAgentFeedRow[] = [],
): Promise<string> {
  const disposalType = (listing.disposal_type as DisposalType) ?? 'to_let';
  const includesToLet = disposalIncludesToLet(disposalType);
  const includesForSale = disposalIncludesForSale(disposalType);
  const rentFromPounds = penceToPounds(listing.asking_rent_pence);
  const rentToPounds =
    penceToPounds(listing.asking_rent_to_pence) ?? rentFromPounds;
  const pricePounds = penceToPounds(listing.asking_price_pence);
  const sizeFrom = listing.size_min_sqft;
  const sizeTo = listing.size_max_sqft ?? listing.size_min_sqft;
  const points = keyPoints(listing.key_points);
  const propertyId = feedPropertyId(listing);

  const images: Array<{ name: string; url: string }> = [];
  const files: Array<{ name: string; url: string; type: string }> = [];

  for (const item of media
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)) {
    const url = await resolveMediaUrl(client, item);
    if (!url) continue;
    const name = item.file_name || `${item.media_type}-${item.id}`;
    const isImage =
      item.media_type === 'image' ||
      Boolean(item.mime_type?.startsWith('image/'));

    if (isImage) {
      images.push({ name, url });
    } else {
      const type =
        item.media_type === 'floorplan'
          ? '2'
          : item.media_type === 'epc'
            ? '3'
            : '11';
      files.push({ name, url, type });
    }
  }

  const showRent =
    includesToLet &&
    rentFromPounds != null &&
    !listing.hide_rent_from_marketing;
  const showPrice =
    includesForSale &&
    pricePounds != null &&
    !listing.hide_price_from_marketing;

  const rentInner = showRent
    ? [
        '<qualifier/>',
        el('from', rentFromPounds),
        el('to', rentToPounds ?? rentFromPounds),
        el(
          'metric',
          listing.rent_frequency === 'per_month'
            ? 'month'
            : listing.rent_frequency === 'per_sqft'
              ? 'sqft'
              : 'annum',
        ),
        el('on_application', '0'),
        '<comment/>',
      ].join('')
    : includesToLet && listing.hide_rent_from_marketing
      ? [
          '<qualifier/>',
          '<from/>',
          '<to/>',
          el('on_application', '1'),
          '<comment/>',
        ].join('')
      : '';

  const priceInner = showPrice
    ? [
        el('value', pricePounds),
        '<qualifier/>',
        '<comment/>',
        el('on_application', '0'),
      ].join('')
    : includesForSale && listing.hide_price_from_marketing
      ? [
          '<value/>',
          '<qualifier/>',
          '<comment/>',
          el('on_application', '1'),
        ].join('')
      : '';

  const rentLabel = showRent
    ? formatMoneyLabel(
        rentFromPounds!,
        listing.rent_frequency === 'per_month'
          ? 'per month'
          : listing.rent_frequency === 'per_sqft'
            ? 'per sq ft'
            : 'per annum',
      )
    : includesToLet && listing.hide_rent_from_marketing
      ? 'POA'
      : '';

  const priceLabel = showPrice
    ? `£${pricePounds!.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
    : includesForSale && listing.hide_price_from_marketing
      ? 'POA'
      : '';

  const imagesXml = images.length
    ? `<images>${images
        .map(
          (img) =>
            `<image name="${escapeXml(img.name)}">${escapeXml(img.url)}</image>`,
        )
        .join('')}</images>`
    : '<images/>';

  const originalImagesXml = images.length
    ? `<original_images>${images
        .map(
          (img) =>
            `<original_image name="${escapeXml(img.name)}">${escapeXml(img.url)}</original_image>`,
        )
        .join('')}</original_images>`
    : '<original_images/>';

  const filesXml = files.length
    ? `<files>${files
        .map(
          (file) =>
            `<file>${el('name', file.name)}${el('description', 'Document')}${el('url', file.url)}${el('type', file.type)}</file>`,
        )
        .join('')}</files>`
    : '<files/>';

  const keyPointsXml = points.length
    ? `<key_selling_points>${points
        .map((p) => `<key_selling_point>${escapeXml(p)}</key_selling_point>`)
        .join('')}</key_selling_points>`
    : '<key_selling_points/>';

  const typesXml = listing.sector
    ? `<types><type>${escapeXml(listing.sector)}</type></types>`
    : '<types/>';

  const availXml = renderAvailabilities(disposalType);

  const resolveClient = (row: CoAgentFeedRow) =>
    Array.isArray(row.clients) ? row.clients[0] : row.clients;

  const contactsXml =
    coAgents.length === 0
      ? '<contacts/>'
      : `<contacts>${coAgents
          .map((row) => {
            const linked = resolveClient(row);
            const office =
              linked?.company_name?.trim() ||
              linked?.display_name?.trim() ||
              'Joint agent';
            const name =
              row.contact_name?.trim() ||
              linked?.display_name?.trim() ||
              office;
            const email =
              row.contact_email?.trim() || linked?.email?.trim() || '';
            const tel =
              row.contact_phone?.trim() || linked?.phone?.trim() || '';
            return [
              '<contact>',
              el('name', name),
              el('email', email),
              el('tel', tel),
              el('mobile', tel),
              el('office', office),
              '<branch/>',
              '</contact>',
            ].join('');
          })
          .join('')}</contacts>`;

  const jointAgentsXml =
    coAgents.length === 0
      ? '<joint_agents/>'
      : `<joint_agents>${coAgents
          .map((row) => {
            const linked = resolveClient(row);
            const office =
              linked?.company_name?.trim() ||
              linked?.display_name?.trim() ||
              'Joint agent';
            const name = row.contact_name?.trim() || office;
            const email =
              row.contact_email?.trim() || linked?.email?.trim() || '';
            const tel =
              row.contact_phone?.trim() || linked?.phone?.trim() || '';
            return [
              '<joint_agent>',
              el('name', name),
              el('email', email),
              el('tel', tel),
              el('mobile', tel),
              el('office', office),
              '</joint_agent>',
            ].join('');
          })
          .join('')}</joint_agents>`;

  return [
    '<property>',
    el('id', propertyId),
    el('object_id', propertyId),
    el('name', listing.name),
    el('address1', listing.address_line_1),
    el('address2', listing.address_line_2),
    el('town', listing.town),
    el('county', listing.county),
    el('postcode', listing.postcode),
    el('lat', listing.latitude != null ? String(listing.latitude) : ''),
    el('lon', listing.longitude != null ? String(listing.longitude) : ''),
    el('created_at', sqlTimestamp(listing.created_at)),
    el('last_updated', sqlTimestamp(listing.updated_at)),
    el('on_market_date', sqlTimestamp(listing.on_market_at)),
    el('featured', 'f'),
    elRaw('specification_summary', cdata(listing.summary)),
    elRaw('specification_description', cdata(listing.description)),
    elRaw('location', cdata(listing.location_copy)),
    keyPointsXml,
    el('size_from', sizeFrom != null ? Math.round(Number(sizeFrom)) : ''),
    el('size_to', sizeTo != null ? Math.round(Number(sizeTo)) : ''),
    el('total_property_size', sizeTo != null ? Math.round(Number(sizeTo)) : ''),
    el('total_property_size_metric', 'sqft'),
    el('area_size_unit', 'sq ft'),
    el('area_size_type', listing.measurement_standard ?? 'gia'),
    el('size_from_sqft', sizeFrom != null ? Math.round(Number(sizeFrom)) : ''),
    el('size_to_sqft', sizeTo != null ? Math.round(Number(sizeTo)) : ''),
    el('size_measure', mapSizeMeasure(listing.measurement_standard)),
    el('rent', rentLabel),
    elRaw('rent_components', rentInner),
    el('price', priceLabel),
    elRaw('price_components', priceInner),
    el('sale_type', includesForSale ? listing.tenure : ''),
    renderFloorUnits(units, includesToLet, includesForSale),
    imagesXml,
    originalImagesXml,
    filesXml,
    '<epcs/>',
    typesXml,
    availXml,
    el('status', mapStatus(listing.status)),
    contactsXml,
    jointAgentsXml,
    el('class_of_use', listing.use_class),
    listing.epc_band
      ? elRaw(
          'current_energy_ratings',
          el('band', listing.epc_band) + el('value', listing.epc_rating ?? ''),
        )
      : '<current_energy_ratings/>',
    '</property>',
  ].join('');
}

export function generatePropertyHiveFeedToken(): string {
  return randomBytes(32).toString('hex');
}

export function buildCommercialFeedUrl(
  token: string,
  portal: CommercialXmlFeedPortal,
): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
      : '');
  const base = configured || 'http://localhost:3000';
  return `${base}${FEED_PATH[portal]}?token=${encodeURIComponent(token)}`;
}

export function buildPropertyHiveFeedUrl(token: string): string {
  return buildCommercialFeedUrl(token, 'property_hive');
}

export function buildEachFeedUrl(token: string): string {
  return buildCommercialFeedUrl(token, 'each');
}

function tokensEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function getCommercialFeedToken(
  accountId: string,
  portal: CommercialXmlFeedPortal,
): Promise<string | null> {
  const { data, error } = await adminDb()
    .from('commercial_portal_credentials')
    .select('metadata')
    .eq('account_id', accountId)
    .eq('portal', portal)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  const token = metadata[FEED_TOKEN_META_KEY];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export async function getPropertyHiveFeedToken(
  accountId: string,
): Promise<string | null> {
  return getCommercialFeedToken(accountId, 'property_hive');
}

export async function getEachFeedToken(
  accountId: string,
): Promise<string | null> {
  return getCommercialFeedToken(accountId, 'each');
}

async function upsertFeedToken(
  accountId: string,
  portal: CommercialXmlFeedPortal,
  token: string,
): Promise<void> {
  const client = adminDb();

  const { data: row } = await client
    .from('commercial_portal_credentials')
    .select('id, metadata')
    .eq('account_id', accountId)
    .eq('portal', portal)
    .maybeSingle();

  const metadata = {
    ...((row?.metadata as Record<string, unknown> | null) ?? {}),
    [FEED_TOKEN_META_KEY]: token,
  };

  if (row?.id) {
    const { error } = await client
      .from('commercial_portal_credentials')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', row.id as string);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from('commercial_portal_credentials').insert({
    account_id: accountId,
    portal,
    metadata,
  });
  if (error) throw new Error(error.message);
}

export async function ensureCommercialFeedToken(
  accountId: string,
  portal: CommercialXmlFeedPortal,
): Promise<{ token: string; feedUrl: string; created: boolean }> {
  const existing = await getCommercialFeedToken(accountId, portal);
  if (existing) {
    return {
      token: existing,
      feedUrl: buildCommercialFeedUrl(existing, portal),
      created: false,
    };
  }

  const token = generatePropertyHiveFeedToken();
  await upsertFeedToken(accountId, portal, token);
  return {
    token,
    feedUrl: buildCommercialFeedUrl(token, portal),
    created: true,
  };
}

export async function rotateCommercialFeedToken(
  accountId: string,
  portal: CommercialXmlFeedPortal,
): Promise<{ token: string; feedUrl: string }> {
  const token = generatePropertyHiveFeedToken();
  await upsertFeedToken(accountId, portal, token);
  return { token, feedUrl: buildCommercialFeedUrl(token, portal) };
}

export async function ensurePropertyHiveFeedToken(
  accountId: string,
): Promise<{ token: string; feedUrl: string; created: boolean }> {
  return ensureCommercialFeedToken(accountId, 'property_hive');
}

export async function rotatePropertyHiveFeedToken(
  accountId: string,
): Promise<{ token: string; feedUrl: string }> {
  return rotateCommercialFeedToken(accountId, 'property_hive');
}

export async function ensureEachFeedToken(
  accountId: string,
): Promise<{ token: string; feedUrl: string; created: boolean }> {
  return ensureCommercialFeedToken(accountId, 'each');
}

export async function rotateEachFeedToken(
  accountId: string,
): Promise<{ token: string; feedUrl: string }> {
  return rotateCommercialFeedToken(accountId, 'each');
}

async function findAccountIdByFeedToken(
  token: string,
  portal: CommercialXmlFeedPortal,
): Promise<string | null> {
  const { data, error } = await adminDb()
    .from('commercial_portal_credentials')
    .select('account_id, metadata')
    .eq('portal', portal)
    .eq('metadata->>xml_feed_token', token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const stored = (data.metadata as Record<string, unknown> | null)?.[
    FEED_TOKEN_META_KEY
  ];
  if (typeof stored !== 'string' || !tokensEqual(stored, token)) {
    return null;
  }

  return data.account_id as string;
}

/**
 * Build Kato-compatible listing XML for a portal feed token.
 * Content is identical across portals today; per-portal listing filters come next.
 */
export async function buildCommercialFeedXml(
  token: string,
  portal: CommercialXmlFeedPortal,
): Promise<{ xml: string; accountId: string } | null> {
  const accountId = await findAccountIdByFeedToken(token, portal);
  if (!accountId) return null;

  const client = adminDb();

  const { data: listings, error } = await client
    .from('commercial_listings')
    .select('*')
    .eq('account_id', accountId)
    .in('status', ['marketing', 'under_offer'])
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  const listingRows = ((listings ?? []) as ListingRow[]).filter((row) =>
    ON_MARKET_STATUSES.has(row.status),
  );

  // Future: filter by portal-specific inclusion flags (e.g. publish_to_each).
  void portal;

  if (!listingRows.length) {
    return {
      accountId,
      xml: `<?xml version="1.0" encoding="utf-8"?>\n<properties/>\n`,
    };
  }

  const listingIds = listingRows.map((l) => l.id);

  const [{ data: units }, { data: media }, { data: coAgentRows }] =
    await Promise.all([
      client
        .from('commercial_listing_units')
        .select('*')
        .in('listing_id', listingIds)
        .order('sort_order'),
      client
        .from('commercial_listing_media')
        .select('*')
        .in('listing_id', listingIds)
        .eq('is_private', false)
        .order('sort_order'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('commercial_listing_co_agents')
        .select(
          'listing_id, contact_name, contact_email, contact_phone, clients(display_name, company_name, email, phone)',
        )
        .eq('account_id', accountId)
        .in('listing_id', listingIds)
        .order('sort_order'),
    ]);

  const unitsByListing = new Map<string, UnitRow[]>();
  for (const unit of (units ?? []) as UnitRow[]) {
    const list = unitsByListing.get(unit.listing_id) ?? [];
    list.push(unit);
    unitsByListing.set(unit.listing_id, list);
  }

  const mediaByListing = new Map<string, MediaRow[]>();
  for (const item of (media ?? []) as MediaRow[]) {
    const list = mediaByListing.get(item.listing_id) ?? [];
    list.push(item);
    mediaByListing.set(item.listing_id, list);
  }

  const coAgentsByListing = new Map<string, CoAgentFeedRow[]>();
  for (const row of (coAgentRows ?? []) as CoAgentFeedRow[]) {
    const list = coAgentsByListing.get(row.listing_id) ?? [];
    list.push(row);
    coAgentsByListing.set(row.listing_id, list);
  }

  const propertiesXml: string[] = [];
  for (const listing of listingRows) {
    propertiesXml.push(
      await renderPropertyXml(
        client,
        listing,
        unitsByListing.get(listing.id) ?? [],
        mediaByListing.get(listing.id) ?? [],
        coAgentsByListing.get(listing.id) ?? [],
      ),
    );
  }

  return {
    accountId,
    xml: `<?xml version="1.0" encoding="utf-8"?>\n<properties>${propertiesXml.join('')}</properties>\n`,
  };
}

export async function buildPropertyHiveFeedXml(
  token: string,
): Promise<{ xml: string; accountId: string } | null> {
  return buildCommercialFeedXml(token, 'property_hive');
}

export async function buildEachFeedXml(
  token: string,
): Promise<{ xml: string; accountId: string } | null> {
  return buildCommercialFeedXml(token, 'each');
}
