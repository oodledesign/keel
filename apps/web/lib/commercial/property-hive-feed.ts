import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type DisposalType,
  disposalIncludesForSale,
  disposalIncludesToLet,
} from '~/lib/commercial/commercial-constants';
import { filterOnMarketListingsForPortalFeed } from '~/lib/commercial/each-feed-inclusion';
import {
  buildCommercialListingMediaPublicUrl,
  resolveSiteUrlForPublicMedia,
} from '~/lib/commercial/listing-media-public-url';
import { resolveCommercialMediaPublicUrl } from '~/lib/commercial/migrate-external-listing-media';
import { renderPropertyHiveOzerListingFields } from '~/lib/commercial/property-hive-custom-fields';
import {
  type FeedActingAgentContact,
  type FeedActingAgentInput,
  type FeedCoAgentRow,
  indexStaffPhonesByEmail,
  renderFeedContactsXml,
  renderFeedJointAgentsXml,
  toFeedActingAgentContacts,
} from '~/lib/commercial/property-hive-feed-contacts';
import { collectPropertyHiveFeedMedia } from '~/lib/commercial/property-hive-feed-media';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

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
  account_branch_id?: string | null;
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
  created_at?: string | null;
};

type CoAgentFeedRow = FeedCoAgentRow & {
  listing_id: string;
};

type ActingAgentFeedRow = {
  listing_id: string;
  user_id: string;
  sort_order: number;
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

async function createSignedUrlMap(
  client: SupabaseClient,
  storagePaths: string[],
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(storagePaths.map((p) => p.trim()).filter(Boolean)),
  ];
  const signedByPath = new Map<string, string>();
  const CHUNK = 100;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data, error } = await client.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(chunk, SIGNED_URL_TTL_SECONDS);

    if (error) {
      console.error(
        '[property-hive-feed] batch signed url error:',
        error.message,
      );
      continue;
    }

    for (let j = 0; j < chunk.length; j++) {
      const requestedPath = chunk[j]!;
      const row = data?.[j];
      const signedUrl = row?.signedUrl;
      if (!signedUrl || row?.error) continue;

      signedByPath.set(requestedPath, signedUrl);
      if (row.path) signedByPath.set(row.path, signedUrl);
    }
  }

  return signedByPath;
}

function resolveMediaUrlFromMaps(
  media: MediaRow,
  signedByPath: Map<string, string>,
  siteUrl: string | null,
): string | null {
  if (siteUrl) {
    return buildCommercialListingMediaPublicUrl({
      siteUrl,
      mediaId: media.id,
      mediaType: media.media_type,
      fileName: media.file_name,
      mimeType: media.mime_type,
    });
  }

  const storagePath = media.storage_path?.trim() || null;
  return resolveCommercialMediaPublicUrl({
    storageSignedUrl: storagePath
      ? (signedByPath.get(storagePath) ?? null)
      : null,
    externalUrl: media.external_url,
  });
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

function renderPropertyXml(
  listing: ListingRow,
  units: UnitRow[],
  media: MediaRow[],
  coAgents: CoAgentFeedRow[] = [],
  signedByPath: Map<string, string> = new Map(),
  siteUrl: string | null = null,
  actingAgents: FeedActingAgentContact[] = [],
): string {
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

  const { images, files } = collectPropertyHiveFeedMedia(media, (item) =>
    resolveMediaUrlFromMaps(item as MediaRow, signedByPath, siteUrl),
  );

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

  const contactsXml = renderFeedContactsXml(actingAgents);
  const jointAgentsXml = renderFeedJointAgentsXml(coAgents);

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
    renderPropertyHiveOzerListingFields(listing.id),
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

async function loadStaffPhonesByEmail(
  client: SupabaseClient,
  accountId: string,
): Promise<Map<string, string>> {
  try {
    const signatures = supabaseCustomSchema(client, 'signatures');
    const { data, error } = await signatures
      .from('staff')
      .select('email, signature_email, phone_direct, phone_mobile')
      .eq('account_id', accountId);

    if (error) {
      console.error(
        '[property-hive-feed] staff phone load error:',
        error.message,
      );
      return new Map();
    }

    return indexStaffPhonesByEmail(data ?? []);
  } catch (err) {
    console.error(
      '[property-hive-feed] staff phone load error:',
      err instanceof Error ? err.message : err,
    );
    return new Map();
  }
}

async function loadActingAgentsByListing(
  client: SupabaseClient,
  accountId: string,
  listingRows: ListingRow[],
): Promise<Map<string, FeedActingAgentContact[]>> {
  const listingIds = listingRows.map((listing) => listing.id);
  const agentsByListing = new Map<string, FeedActingAgentContact[]>();
  if (!listingIds.length) return agentsByListing;

  const { data: agentRows, error: agentError } = await client
    .from('commercial_listing_agents')
    .select('listing_id, user_id, sort_order')
    .eq('account_id', accountId)
    .in('listing_id', listingIds)
    .order('sort_order', { ascending: true });

  if (agentError) {
    console.error(
      '[property-hive-feed] acting agents load error:',
      agentError.message,
    );
    return agentsByListing;
  }

  const rows = (agentRows ?? []) as ActingAgentFeedRow[];
  if (!rows.length) return agentsByListing;

  const listingById = new Map(
    listingRows.map((listing) => [listing.id, listing]),
  );
  const userIds = [...new Set(rows.map((row) => row.user_id))];

  const [
    { data: accountRow },
    { data: branchRows },
    { data: memberAccounts },
    phoneByEmail,
  ] = await Promise.all([
    client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
    client
      .from('account_branches')
      .select('id, name')
      .eq('account_id', accountId),
    client.from('accounts').select('id, name, email').in('id', userIds),
    loadStaffPhonesByEmail(client, accountId),
  ]);

  const officeName =
    (accountRow?.name as string | null | undefined)?.trim() || '';
  const branchNameById = new Map<string, string>();
  for (const branch of (branchRows ?? []) as Array<{
    id: string;
    name: string | null;
  }>) {
    const name = branch.name?.trim();
    if (name) branchNameById.set(branch.id, name);
  }

  const memberById = new Map<
    string,
    { name: string | null; email: string | null }
  >();

  for (const member of (memberAccounts ?? []) as Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>) {
    memberById.set(member.id, {
      name: member.name,
      email: member.email,
    });
  }

  const inputsByListing = new Map<string, FeedActingAgentInput[]>();
  for (const row of rows) {
    const member = memberById.get(row.user_id);
    const email = member?.email?.trim() || null;
    const list = inputsByListing.get(row.listing_id) ?? [];
    list.push({
      name: member?.name ?? null,
      email,
      phone: email ? (phoneByEmail.get(email.toLowerCase()) ?? null) : null,
    });
    inputsByListing.set(row.listing_id, list);
  }

  for (const [listingId, agents] of inputsByListing) {
    const listing = listingById.get(listingId);
    const branchId = listing?.account_branch_id?.trim() || null;
    const mapped = toFeedActingAgentContacts(agents, {
      office: officeName,
      branch: branchId ? (branchNameById.get(branchId) ?? '') : '',
    });
    if (mapped.length) agentsByListing.set(listingId, mapped);
  }

  return agentsByListing;
}

/**
 * Build Kato-compatible listing XML for a portal feed token.
 * EACH and website (Property Hive) both exclude listings with an unpublished
 * publication for that portal. Missing publication rows stay included.
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

  let listingRows = ((listings ?? []) as ListingRow[]).filter((row) =>
    ON_MARKET_STATUSES.has(row.status),
  );

  // Property Hive / EACH match on Kato <id>/<object_id>. Listings without an
  // external_id would export as an Ozer UUID and create duplicate WP posts.
  const beforeExternalFilter = listingRows.length;
  listingRows = listingRows.filter((row) => Boolean(row.external_id?.trim()));
  if (listingRows.length < beforeExternalFilter) {
    console.warn(
      `[${portal}-feed] skipped ${beforeExternalFilter - listingRows.length} on-market listing(s) without external_id (avoids duplicate Property Hive posts)`,
    );
  }

  if (listingRows.length > 0) {
    const candidateIds = listingRows.map((l) => l.id);
    const optOutPortal = portal === 'each' ? 'each' : 'property_hive';
    const { data: optedOut, error: pubError } = await client
      .from('commercial_portal_publications')
      .select('listing_id')
      .eq('account_id', accountId)
      .eq('portal', optOutPortal)
      .eq('status', 'unpublished')
      .in('listing_id', candidateIds);

    if (pubError) throw new Error(pubError.message);

    const unpublishedIds = new Set(
      (optedOut ?? []).map((row) => row.listing_id as string),
    );
    listingRows = filterOnMarketListingsForPortalFeed({
      portal,
      listings: listingRows,
      unpublishedEachListingIds: portal === 'each' ? unpublishedIds : new Set(),
      unpublishedWebsiteListingIds:
        portal === 'property_hive' ? unpublishedIds : new Set(),
    });
  }

  if (!listingRows.length) {
    return {
      accountId,
      xml: `<?xml version="1.0" encoding="utf-8"?>\n<properties/>\n`,
    };
  }

  const listingIds = listingRows.map((l) => l.id);

  const [
    { data: units },
    { data: media },
    { data: coAgentRows },
    actingAgentsByListing,
  ] = await Promise.all([
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
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)
      .from('commercial_listing_co_agents')
      .select(
        'listing_id, contact_name, contact_email, contact_phone, clients(display_name, company_name, email, phone)',
      )
      .eq('account_id', accountId)
      .in('listing_id', listingIds)
      .order('sort_order'),
    loadActingAgentsByListing(client, accountId, listingRows),
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

  const allMedia = (media ?? []) as MediaRow[];
  const siteUrl = resolveSiteUrlForPublicMedia();
  const signedByPath = siteUrl
    ? new Map<string, string>()
    : await createSignedUrlMap(
        client,
        allMedia
          .map((item) => item.storage_path)
          .filter((path): path is string => Boolean(path?.trim())),
      );

  if (!siteUrl && allMedia.length > 0) {
    console.warn(
      '[property-hive-feed] NEXT_PUBLIC_APP_SITE_URL not set; falling back to signed storage URLs (may fail Property Hive import)',
    );
  }

  const propertiesXml = listingRows.map((listing) =>
    renderPropertyXml(
      listing,
      unitsByListing.get(listing.id) ?? [],
      mediaByListing.get(listing.id) ?? [],
      coAgentsByListing.get(listing.id) ?? [],
      signedByPath,
      siteUrl,
      actingAgentsByListing.get(listing.id) ?? [],
    ),
  );

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
