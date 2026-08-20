/**
 * Parse Kato / Agents Society listing XML for document media
 * (`<files>` PDFs and `<epcs>`), excluding gallery `<images>`.
 */

export const DEFAULT_KATO_FEED_URL =
  'https://s3-eu-west-1.amazonaws.com/feeds.agents-society.com/828-ai-feed-1526805793.xml';

export type KatoFeedMediaType = 'brochure' | 'floorplan' | 'epc' | 'other';

export type KatoFeedFileItem = {
  externalId: string;
  mediaType: KatoFeedMediaType;
  fileName: string;
  url: string;
  source: 'files' | 'epc';
  katoFileType: string | null;
};

function parseListingDisplayName(block: string): string | null {
  const match = block.match(
    /<(?:object_id|id)>[\s\S]*?<\/(?:object_id|id)>\s*<name>([\s\S]*?)<\/name>/i,
  );
  if (!match?.[1]) return null;
  const value = decodeXmlEntities(
    match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
  );
  return value || null;
}

function xmlText(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  const value = match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  return value ? decodeXmlEntities(value) : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function mapKatoFileType(
  type: string | null,
  description?: string | null,
): KatoFeedMediaType {
  const t = (type ?? '').trim();
  if (t === '11') return 'brochure';
  if (t === '15') return 'floorplan';
  if (t === '2') return 'floorplan';
  if (t === '3') return 'epc';

  const haystack = `${description ?? ''}`.toLowerCase();
  if (haystack.includes('floor plan') || haystack.includes('floorplan')) {
    return 'floorplan';
  }
  if (haystack.includes('epc') || haystack.includes('energy performance')) {
    return 'epc';
  }
  return 'other';
}

function parseFileBlocks(
  propertyBlock: string,
  externalId: string,
): KatoFeedFileItem[] {
  const items: KatoFeedFileItem[] = [];
  const fileRe = /<file\b[^>]*>([\s\S]*?)<\/file>/gi;
  let match: RegExpExecArray | null;
  while ((match = fileRe.exec(propertyBlock))) {
    const inner = match[1] ?? '';
    const url = xmlText(inner, 'url');
    if (!url) continue;
    const fileName =
      xmlText(inner, 'name') ||
      url.split('/').pop()?.split('?')[0] ||
      `file-${items.length + 1}.pdf`;
    const katoFileType = xmlText(inner, 'type');
    items.push({
      externalId,
      mediaType: mapKatoFileType(katoFileType, xmlText(inner, 'description')),
      fileName: decodeXmlEntities(fileName),
      url: decodeXmlEntities(url),
      source: 'files',
      katoFileType,
    });
  }
  return items;
}

function parseEpcBlocks(
  propertyBlock: string,
  externalId: string,
): KatoFeedFileItem[] {
  const items: KatoFeedFileItem[] = [];
  const epcRe = /<epc\b[^>]*>([\s\S]*?)<\/epc>/gi;
  let match: RegExpExecArray | null;
  while ((match = epcRe.exec(propertyBlock))) {
    const inner = match[1] ?? '';
    const url = xmlText(inner, 'url');
    if (!url) continue;
    const fileName =
      xmlText(inner, 'name') ||
      url.split('/').pop()?.split('?')[0] ||
      `epc-${items.length + 1}.pdf`;
    items.push({
      externalId,
      mediaType: 'epc',
      fileName: decodeXmlEntities(fileName),
      url: decodeXmlEntities(url),
      source: 'epc',
      katoFileType: null,
    });
  }
  return items;
}

function forEachProperty(
  xml: string,
  fn: (block: string, externalId: string) => void,
) {
  const propertyRe = /<property\b[^>]*>([\s\S]*?)<\/property>/gi;
  let propertyMatch: RegExpExecArray | null;
  while ((propertyMatch = propertyRe.exec(xml))) {
    const block = propertyMatch[1] ?? '';
    const externalId = xmlText(block, 'id') || xmlText(block, 'object_id');
    if (!externalId) continue;
    fn(block, externalId);
  }
}

export function parseKatoFeedFiles(xml: string): KatoFeedFileItem[] {
  const items: KatoFeedFileItem[] = [];
  forEachProperty(xml, (block, externalId) => {
    items.push(...parseFileBlocks(block, externalId));
    items.push(...parseEpcBlocks(block, externalId));
  });
  return items;
}

const FLOOR_LABELS: Record<string, string> = {
  g: 'Ground',
  gf: 'Ground',
  m: 'Mezzanine',
  '1st': '1st floor',
  '2nd': '2nd floor',
  '3rd': '3rd floor',
  unit: 'Unit',
};

export function mapKatoFloorLabel(code: string | null): string {
  const key = (code ?? '').trim().toLowerCase();
  if (!key) return 'Unit';
  return FLOOR_LABELS[key] ?? code!.trim();
}

export function mapKatoEpcBand(raw: string | null): string | null {
  const letter = (raw ?? '').trim().toUpperCase();
  if (!/^[A-G]$/.test(letter)) return null;
  return letter;
}

export type KatoFeedUnit = {
  listingExternalId: string;
  unitExternalId: string;
  label: string;
  floorOrUnit: string | null;
  description: string | null;
  sizeSqft: number | null;
  askingRentPence: number | null;
  rentPerSqft: number | null;
  fittedSpace: boolean | null;
  status: string | null;
  sortOrder: number;
};

export type KatoFeedEpcBand = {
  listingExternalId: string;
  epcBand: string;
  epcRating: number | null;
};

function parseRatingAttribute(openTag: string, name: string): number | null {
  const match = openTag.match(new RegExp(`\\b${name}="(\\d+)"`, 'i'));
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseKatoFeedEpcBands(xml: string): KatoFeedEpcBand[] {
  const rows: KatoFeedEpcBand[] = [];
  forEachProperty(xml, (block, listingExternalId) => {
    const ratingsBlock = block.match(
      /<current_energy_ratings>([\s\S]*?)<\/current_energy_ratings>/i,
    )?.[1];
    if (!ratingsBlock) return;
    const ratingRe = /<rating\b([^>]*)>([\s\S]*?)<\/rating>/gi;
    let match: RegExpExecArray | null;
    const parsed: Array<{ band: string; rating: number | null }> = [];
    while ((match = ratingRe.exec(ratingsBlock))) {
      const band = mapKatoEpcBand(match[2] ?? null);
      if (!band) continue;
      parsed.push({
        band,
        rating: parseRatingAttribute(match[1] ?? '', 'value'),
      });
    }
    if (parsed.length === 0) return;
    const worst = [...parsed]
      .sort((a, b) => a.band.localeCompare(b.band))
      .at(-1)!;
    rows.push({
      listingExternalId,
      epcBand: worst.band,
      epcRating: worst.rating,
    });
  });
  return rows;
}

function parseOptionalMoneyPence(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  if (/on\s+application|poa|tbc/i.test(raw)) return null;
  const normalized = raw.replace(/,/g, '');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const pounds = Number(match[0]);
  if (!Number.isFinite(pounds)) return null;
  return Math.round(pounds * 100);
}

function parseOptionalNumber(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const match = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parseFittedSpace(raw: string | null): boolean | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().toLowerCase();
  if (
    s === 'not fitted' ||
    s === 'unfitted' ||
    s === 'no' ||
    s === 'false' ||
    s === 'f' ||
    s === '0'
  ) {
    return false;
  }
  if (s === 'fitted' || s === 'yes' || s === 'true' || s === 't' || s === '1') {
    return true;
  }
  return null;
}

export type KatoFeedListingAttrs = {
  listingExternalId: string;
  displayName: string | null;
  hideRentFromMarketing: boolean;
  hidePriceFromMarketing: boolean;
  ratesPayablePerSqft: number | null;
  measurementStandard: string | null;
  specificationsTitle: string | null;
  specificationsBody: string | null;
  insuranceType: string | null;
  tenancyStatus: string | null;
  landSizeMin: number | null;
  landSizeMax: number | null;
  landSizeMetric: 'hectare' | 'acres' | 'sqft' | 'sqm' | null;
  onMarketAt: string | null;
  streetViewPanoId: string | null;
  streetViewHeading: number | null;
  streetViewPitch: number | null;
  streetViewZoom: number | null;
  fittedSpace: boolean | null;
};

function isOnApplicationFlag(block: string): boolean {
  if (/\bon\s+application\b|\bpoa\b|\broa\b/i.test(block)) return true;
  const flag = xmlText(block, 'on_application');
  return flag === '1' || flag?.toLowerCase() === 'true';
}

export function mapKatoMeasurementStandard(raw: string | null): string | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('net internal') || s === 'nia') return 'nia';
  if (s.includes('gross external') || s === 'gea') return 'gea';
  if (s.includes('gross internal') || s === 'gia') return 'gia';
  if (s.includes('site')) return 'site';
  if (s.includes('ipms')) return 'ipms';
  return null;
}

export function mapKatoLandMetric(
  raw: string | null,
): KatoFeedListingAttrs['landSizeMetric'] {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('hectare') || s === 'ha') return 'hectare';
  if (s.includes('acre')) return 'acres';
  if (s.includes('sqm') || s.includes('sq m') || s.includes('metre')) {
    return 'sqm';
  }
  if (s.includes('sqft') || s.includes('sq ft') || s.includes('foot')) {
    return 'sqft';
  }
  return null;
}

function parseOnMarketAt(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const normalized = raw.trim().replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function parseKatoFeedListingAttrs(xml: string): KatoFeedListingAttrs[] {
  const rows: KatoFeedListingAttrs[] = [];
  forEachProperty(xml, (block, listingExternalId) => {
    const rentComponents =
      block.match(/<rent_components>([\s\S]*?)<\/rent_components>/i)?.[1] ?? '';
    const priceComponents =
      block.match(/<price_components>([\s\S]*?)<\/price_components>/i)?.[1] ??
      '';
    const ratesPeriod = (
      xmlText(block, 'rateable_value_period') ?? ''
    ).toLowerCase();
    const ratesPayable = parseOptionalNumber(xmlText(block, 'rates_payable'));
    const ratesPayablePerSqft =
      ratesPayable != null &&
      (ratesPeriod.includes('sqft') || ratesPeriod.includes('sq ft'))
        ? ratesPayable
        : null;

    const streetView =
      block.match(/<street_view_data>([\s\S]*?)<\/street_view_data>/i)?.[1] ??
      '';

    rows.push({
      listingExternalId,
      displayName: parseListingDisplayName(block),
      hideRentFromMarketing:
        isOnApplicationFlag(xmlText(block, 'rent') ?? '') ||
        isOnApplicationFlag(rentComponents),
      hidePriceFromMarketing:
        isOnApplicationFlag(xmlText(block, 'price') ?? '') ||
        isOnApplicationFlag(priceComponents),
      ratesPayablePerSqft,
      measurementStandard: mapKatoMeasurementStandard(
        xmlText(block, 'size_measure'),
      ),
      specificationsTitle: xmlText(block, 'marketing_title_1'),
      specificationsBody: xmlText(block, 'marketing_text_1'),
      insuranceType: xmlText(block, 'insurance_type'),
      tenancyStatus: xmlText(block, 'tenancy_status'),
      landSizeMin: parseOptionalNumber(xmlText(block, 'land_size_from')),
      landSizeMax: parseOptionalNumber(xmlText(block, 'land_size_to')),
      landSizeMetric: mapKatoLandMetric(xmlText(block, 'land_size_metric')),
      onMarketAt: parseOnMarketAt(xmlText(block, 'on_market_date')),
      streetViewPanoId: xmlText(streetView, 'pano'),
      streetViewHeading: parseOptionalNumber(xmlText(streetView, 'heading')),
      streetViewPitch: parseOptionalNumber(xmlText(streetView, 'pitch')),
      streetViewZoom: parseOptionalNumber(xmlText(streetView, 'zoom')),
      fittedSpace:
        parseFittedSpace(xmlText(block, 'fitted')) ??
        parseFittedSpace(xmlText(block, 'fitted_comment')),
    });
  });
  return rows;
}

export function parseKatoFeedUnits(xml: string): KatoFeedUnit[] {
  const units: KatoFeedUnit[] = [];
  forEachProperty(xml, (block, listingExternalId) => {
    const unitRe = /<floor_unit\b[^>]*>([\s\S]*?)<\/floor_unit>/gi;
    let match: RegExpExecArray | null;
    let sortOrder = 0;
    while ((match = unitRe.exec(block))) {
      const inner = match[1] ?? '';
      const metaId = xmlText(inner, 'meta_id');
      const floorCode = xmlText(inner, 'floorunit');
      const description = xmlText(inner, 'description');
      const floorOrUnit = mapKatoFloorLabel(floorCode);
      const label =
        [floorOrUnit, description].filter(Boolean).join(' · ') || 'Unit';
      units.push({
        listingExternalId,
        unitExternalId: metaId || `${listingExternalId}-${sortOrder}`,
        label,
        floorOrUnit,
        description,
        sizeSqft: parseOptionalNumber(
          xmlText(inner, 'size_sqft') || xmlText(inner, 'size'),
        ),
        askingRentPence: parseOptionalMoneyPence(xmlText(inner, 'rent_price')),
        rentPerSqft: parseOptionalNumber(xmlText(inner, 'rent_sqft')),
        fittedSpace: parseFittedSpace(xmlText(inner, 'fitted_space')),
        status: xmlText(inner, 'status'),
        sortOrder,
      });
      sortOrder += 1;
    }
  });
  return units;
}

export function katoFileAlreadyExists(
  existing: Array<{ file_name: string | null; external_url: string | null }>,
  item: Pick<KatoFeedFileItem, 'fileName' | 'url'>,
): boolean {
  const name = item.fileName.trim().toLowerCase();
  const url = item.url.trim().toLowerCase();
  return existing.some((row) => {
    const rowName = row.file_name?.trim().toLowerCase() ?? '';
    const rowUrl = row.external_url?.trim().toLowerCase() ?? '';
    if (rowName && rowName === name) return true;
    if (rowUrl && rowUrl === url) return true;
    return false;
  });
}

export async function fetchKatoFeedXml(feedUrl: string): Promise<string> {
  const response = await fetch(feedUrl, {
    headers: { Accept: 'application/xml,text/xml,*/*' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Kato feed fetch failed (${response.status})`);
  }
  return response.text();
}
