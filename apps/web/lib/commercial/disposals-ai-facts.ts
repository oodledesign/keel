/**
 * Public-safe disposals facts for the Disposals "Ask AI" assistant.
 *
 * Only the columns in `DISPOSALS_AI_LISTING_COLUMNS` are loaded, and only the
 * fields built in `toPublicItem` ever reach the model. Client, party, notes,
 * internal terms and fee data are never read here.
 */
import { formatAskingPrice } from './asking-price';
import {
  DISPOSAL_TYPE_LABELS,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
} from './commercial-constants';

type Row = Record<string, unknown>;

/** Columns the assistant may load. Access-filter columns are never output. */
export const DISPOSALS_AI_LISTING_COLUMNS = [
  'id',
  'name',
  'address_line_1',
  'town',
  'county',
  'postcode',
  'sector',
  'disposal_type',
  'tenure',
  'size_min_sqft',
  'size_max_sqft',
  'asking_rent_pence',
  'asking_rent_to_pence',
  'rent_frequency',
  'asking_price_pence',
  'asking_price_qualifier',
  'hide_rent_from_marketing',
  'hide_price_from_marketing',
  'status',
  'created_at',
  'on_market_at',
  'off_market_at',
  'restrict_access_to_assigned',
  'assigned_to',
  'pa_user_id',
  'record_owner_user_id',
  'created_by',
].join(', ');

export const DISPOSALS_AI_HISTORY_EVENT_TYPES = [
  'status_changed',
  'listing_created',
] as const;

const MAX_ITEMS_PER_BUCKET = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DisposalsAiPeriod = {
  from: string;
  to: string;
  label: string;
  /** True when the period runs past now and was cut off at today. */
  partial: boolean;
};

export type DisposalsAiEvent = {
  listingId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DisposalsAiItem = {
  property: string;
  propertyType: string | null;
  disposalType: string | null;
  tenure: string | null;
  size: string | null;
  askingRent: string | null;
  askingPrice: string | null;
  status: string;
  date: string;
};

export const DISPOSALS_AI_BUCKETS = [
  'newInstructions',
  'launched',
  'underOffer',
  'completed',
  'withdrawn',
] as const;

export type DisposalsAiBucket = (typeof DISPOSALS_AI_BUCKETS)[number];

export const DISPOSALS_AI_BUCKET_LABELS: Record<DisposalsAiBucket, string> = {
  newInstructions: 'New instructions',
  launched: 'Launched to market',
  underOffer: 'Went under offer',
  completed: 'Completed (let or sold)',
  withdrawn: 'Withdrawn',
};

export type DisposalsAiBucketFacts = {
  count: number;
  byPropertyType: Record<string, number>;
  items: DisposalsAiItem[];
};

export type DisposalsAiPeriodFacts = {
  period: DisposalsAiPeriod;
  limitedHistory: boolean;
  activity: Record<DisposalsAiBucket, DisposalsAiBucketFacts>;
};

export type DisposalsAiFacts = {
  generatedOn: string;
  period: DisposalsAiPeriodFacts;
  comparison: DisposalsAiPeriodFacts | null;
  currentSnapshot: {
    byStatus: Record<string, number>;
    liveDisposals: number;
  };
  dataNotes: string[];
};

// ---------------------------------------------------------------------------
// Period resolution
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const MONTH_PATTERN =
  /\b(last\s+|previous\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s+(20\d{2}))?/gi;

const MAY_CONTEXT = /\b(in|last|during|vs|versus|since|from|to|and|of)\s+$/i;

const COMPARE_CUE =
  /\b(vs\.?|versus|compare[ds]?|comparison|against|year[\s-]on[\s-]year|yoy)\b/i;

type Mention =
  | {
      kind: 'month';
      index: number;
      end: number;
      month: number;
      year: number | null;
      last: boolean;
    }
  | { kind: 'lastYear'; index: number; end: number }
  | {
      kind: 'fixed';
      index: number;
      end: number;
      resolve: (now: Date) => DisposalsAiPeriod;
    };

function utc(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month, day));
}

function shiftYears(date: Date, years: number): Date {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const monthFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function isMonthStart(date: Date): boolean {
  return (
    date.getUTCDate() === 1 &&
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

function labelRange(from: Date, end: Date, partial: boolean): string {
  const suffix = partial ? ' (to date)' : '';
  if (isMonthStart(from) && isMonthStart(end)) {
    const months =
      (end.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - from.getUTCMonth());
    if (months === 1) return `${monthFormatter.format(from)}${suffix}`;
    if (months === 12 && from.getUTCMonth() === 0) {
      return `${from.getUTCFullYear()}${suffix}`;
    }
  }
  const last = new Date(Math.max(from.getTime(), end.getTime() - 1));
  return `${dayFormatter.format(from)} – ${dayFormatter.format(last)}${suffix}`;
}

/** Build a period ending at `end`, clipped to `now` when it runs into the future. */
export function makeDisposalsAiPeriod(
  from: Date,
  end: Date,
  now: Date,
): DisposalsAiPeriod {
  const partial = end.getTime() > now.getTime();
  const to = new Date(
    Math.max(from.getTime(), Math.min(end.getTime(), now.getTime())),
  );
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: labelRange(from, partial ? end : to, partial),
    partial,
  };
}

function monthPeriod(year: number, month: number, now: Date) {
  return makeDisposalsAiPeriod(utc(year, month), utc(year, month + 1), now);
}

/** Same dates one year earlier (like-for-like when the period is partial). */
function shiftPeriodBackAYear(
  period: DisposalsAiPeriod,
  now: Date,
): DisposalsAiPeriod {
  return makeDisposalsAiPeriod(
    shiftYears(new Date(period.from), -1),
    shiftYears(new Date(period.to), -1),
    now,
  );
}

function monthIndex(token: string): number {
  const lower = token.toLowerCase();
  return MONTH_NAMES.findIndex((name) => name.startsWith(lower.slice(0, 3)));
}

function collectMentions(text: string): Mention[] {
  const mentions: Mention[] = [];

  for (const match of text.matchAll(MONTH_PATTERN)) {
    const index = match.index ?? 0;
    const last = Boolean(match[1]);
    const token = match[2]!;
    const year = match[3] ? Number(match[3]) : null;
    if (
      token.toLowerCase() === 'may' &&
      !year &&
      !last &&
      !MAY_CONTEXT.test(text.slice(0, index))
    ) {
      continue;
    }
    mentions.push({
      kind: 'month',
      index,
      end: index + match[0].length,
      month: monthIndex(token),
      year,
      last,
    });
  }

  const fixed: Array<{
    pattern: RegExp;
    resolve: (match: RegExpMatchArray, now: Date) => DisposalsAiPeriod;
  }> = [
    {
      pattern: /\b(last|previous|past)\s+month\b/gi,
      resolve: (_m, now) =>
        monthPeriod(now.getUTCFullYear(), now.getUTCMonth() - 1, now),
    },
    {
      pattern: /\bthis\s+month\b/gi,
      resolve: (_m, now) =>
        monthPeriod(now.getUTCFullYear(), now.getUTCMonth(), now),
    },
    {
      pattern: /\b(last|previous|past)\s+quarter\b/gi,
      resolve: (_m, now) => {
        const q = Math.floor(now.getUTCMonth() / 3);
        const year = now.getUTCFullYear();
        return makeDisposalsAiPeriod(
          utc(year, (q - 1) * 3),
          utc(year, q * 3),
          now,
        );
      },
    },
    {
      pattern: /\bthis\s+quarter\b/gi,
      resolve: (_m, now) => {
        const q = Math.floor(now.getUTCMonth() / 3);
        const year = now.getUTCFullYear();
        return makeDisposalsAiPeriod(
          utc(year, q * 3),
          utc(year, q * 3 + 3),
          now,
        );
      },
    },
    {
      pattern: /\b(?:last|past|previous)\s+(\d{1,2})\s+months?\b/gi,
      resolve: (m, now) => {
        const months = Math.max(1, Number(m[1]));
        const from = new Date(now.getTime());
        from.setUTCMonth(from.getUTCMonth() - months);
        return makeDisposalsAiPeriod(from, now, now);
      },
    },
    {
      pattern: /\b(?:last|past|previous)\s+(\d{1,3})\s+days?\b/gi,
      resolve: (m, now) =>
        makeDisposalsAiPeriod(
          new Date(now.getTime() - Math.max(1, Number(m[1])) * DAY_MS),
          now,
          now,
        ),
    },
    {
      pattern: /\b(?:last|past|previous)\s+week\b/gi,
      resolve: (_m, now) =>
        makeDisposalsAiPeriod(new Date(now.getTime() - 7 * DAY_MS), now, now),
    },
    {
      pattern: /\b(this\s+year|year\s+to\s+date|ytd)\b/gi,
      resolve: (_m, now) => {
        const year = now.getUTCFullYear();
        return makeDisposalsAiPeriod(utc(year, 0), utc(year + 1, 0), now);
      },
    },
    {
      pattern: /\b(20\d{2})\b/g,
      resolve: (m, now) => {
        const year = Number(m[1]);
        return makeDisposalsAiPeriod(utc(year, 0), utc(year + 1, 0), now);
      },
    },
  ];

  for (const { pattern, resolve } of fixed) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      mentions.push({
        kind: 'fixed',
        index,
        end: index + match[0].length,
        resolve: (now) => resolve(match, now),
      });
    }
  }

  for (const match of text.matchAll(/\b(last|previous)\s+year\b/gi)) {
    const index = match.index ?? 0;
    mentions.push({ kind: 'lastYear', index, end: index + match[0].length });
  }

  mentions.sort((a, b) => a.index - b.index || b.end - a.end);
  const accepted: Mention[] = [];
  for (const mention of mentions) {
    const overlaps = accepted.some(
      (prev) => mention.index < prev.end && mention.end > prev.index,
    );
    if (!overlaps) accepted.push(mention);
  }
  return accepted;
}

/** Most recent occurrence of `month`, on or before the current month. */
function recentMonthYear(month: number, now: Date, strictlyBefore: boolean) {
  const current = now.getUTCMonth();
  const year = now.getUTCFullYear();
  if (month < current) return year;
  if (month === current && !strictlyBefore) return year;
  return year - 1;
}

function resolveMention(mention: Mention, now: Date): DisposalsAiPeriod {
  switch (mention.kind) {
    case 'month': {
      const year =
        mention.year ?? recentMonthYear(mention.month, now, mention.last);
      return monthPeriod(year, mention.month, now);
    }
    case 'lastYear': {
      const year = now.getUTCFullYear() - 1;
      return makeDisposalsAiPeriod(utc(year, 0), utc(year + 1, 0), now);
    }
    case 'fixed':
      return mention.resolve(now);
  }
}

/**
 * Read the period (and optional comparison period) from a free-text prompt.
 * Defaults to last calendar month when no period is mentioned.
 */
export function resolveDisposalsAiPeriods(
  prompt: string,
  now: Date,
): { period: DisposalsAiPeriod; comparison: DisposalsAiPeriod | null } {
  const [first, second] = collectMentions(prompt);

  const period = first
    ? resolveMention(first, now)
    : monthPeriod(now.getUTCFullYear(), now.getUTCMonth() - 1, now);

  if (second) {
    if (second.kind === 'lastYear') {
      return { period, comparison: shiftPeriodBackAYear(period, now) };
    }
    if (
      second.kind === 'month' &&
      first?.kind === 'month' &&
      second.year === null &&
      second.month === first.month
    ) {
      const year = new Date(period.from).getUTCFullYear() - 1;
      return { period, comparison: monthPeriod(year, second.month, now) };
    }
    return { period, comparison: resolveMention(second, now) };
  }

  if (COMPARE_CUE.test(prompt)) {
    return { period, comparison: shiftPeriodBackAYear(period, now) };
  }

  return { period, comparison: null };
}

// ---------------------------------------------------------------------------
// Public-safe facts
// ---------------------------------------------------------------------------

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function humanize(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  const spaced = text.replace(/[_-]+/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusLabel(status: unknown): string {
  const key = str(status) ?? '';
  return (
    (LISTING_STATUS_LABELS as Record<string, string>)[key] ??
    humanize(key) ??
    'Unknown'
  );
}

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

const sqft = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

function formatSize(row: Row): string | null {
  const min = num(row.size_min_sqft);
  const max = num(row.size_max_sqft);
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min !== max) {
    return `${sqft.format(min)} – ${sqft.format(max)} sq ft`;
  }
  return `${sqft.format((min ?? max)!)} sq ft`;
}

function includesToLet(row: Row): boolean {
  const type = str(row.disposal_type);
  return type === 'to_let' || type === 'to_let_and_for_sale';
}

function includesForSale(row: Row): boolean {
  const type = str(row.disposal_type);
  return (
    type === 'for_sale' ||
    type === 'to_let_and_for_sale' ||
    type === 'investment'
  );
}

/**
 * Publicly marketed disposals can be named and show asking terms; others are
 * described by area only.
 */
export function isPubliclyMarketed(row: Row): boolean {
  const status = str(row.status);
  return (
    Boolean(str(row.on_market_at)) ||
    status === 'marketing' ||
    status === 'under_offer'
  );
}

function formatRent(row: Row): string | null {
  if (!includesToLet(row) || row.hide_rent_from_marketing === true) {
    return null;
  }
  const from = num(row.asking_rent_pence);
  const to = num(row.asking_rent_to_pence);
  if (from === null && to === null) return null;
  const range =
    from !== null && to !== null && from !== to
      ? `${gbp.format(from / 100)} – ${gbp.format(to / 100)}`
      : gbp.format((from ?? to)! / 100);
  const freq = str(row.rent_frequency);
  if (!freq || freq === 'pa' || freq === 'per_annum') return `${range} pa`;
  if (freq === 'pcm' || freq === 'per_month') return `${range} pcm`;
  return `${range} ${humanize(freq)?.toLowerCase()}`;
}

function formatPrice(row: Row): string | null {
  if (!includesForSale(row) || row.hide_price_from_marketing === true) {
    return null;
  }
  return formatAskingPrice({
    askingPricePence: num(row.asking_price_pence),
    askingPriceQualifier: str(row.asking_price_qualifier),
    hidePriceFromMarketing: false,
  });
}

function postcodeDistrict(postcode: unknown): string | null {
  const text = str(postcode)?.toUpperCase();
  if (!text) return null;
  return text.split(/\s+/)[0] ?? null;
}

function area(row: Row): string | null {
  return str(row.town) ?? str(row.county) ?? postcodeDistrict(row.postcode);
}

function propertyLabel(row: Row, publicListing: boolean): string {
  const place = area(row);
  if (publicListing) {
    const name = str(row.name) ?? str(row.address_line_1);
    if (name && place && !name.toLowerCase().includes(place.toLowerCase())) {
      return `${name}, ${place}`;
    }
    if (name) return name;
  }
  const type = str(row.sector);
  const where = place ?? 'undisclosed location';
  return type ? `${type} in ${where}` : `Property in ${where}`;
}

/** The only shape of listing data that reaches the model. */
export function toPublicItem(row: Row, date: string): DisposalsAiItem {
  const publicListing = isPubliclyMarketed(row);
  const disposalType = str(row.disposal_type);
  return {
    property: propertyLabel(row, publicListing),
    propertyType: str(row.sector),
    disposalType: disposalType
      ? ((DISPOSAL_TYPE_LABELS as Record<string, string>)[disposalType] ??
        humanize(disposalType))
      : null,
    tenure: humanize(row.tenure),
    size: publicListing ? formatSize(row) : null,
    askingRent: publicListing ? formatRent(row) : null,
    askingPrice: publicListing ? formatPrice(row) : null,
    status: statusLabel(row.status),
    date: date.slice(0, 10),
  };
}

function eventBuckets(event: DisposalsAiEvent): DisposalsAiBucket[] {
  const status = str(event.metadata.status);
  if (!status) return [];

  if (event.eventType === 'listing_created') {
    const out: DisposalsAiBucket[] = [];
    if (status !== 'draft' && status !== 'withdrawn') {
      out.push('newInstructions');
    }
    if (status === 'marketing') out.push('launched');
    return out;
  }

  if (event.eventType !== 'status_changed') return [];

  const previous = str(event.metadata.previousStatus);
  const out: DisposalsAiBucket[] = [];
  if (previous === 'draft' && status !== 'withdrawn') {
    out.push('newInstructions');
  }
  if (status === 'marketing' && previous !== 'under_offer') {
    out.push('launched');
  }
  if (status === 'under_offer') out.push('underOffer');
  if (status === 'let' || status === 'sold') out.push('completed');
  if (status === 'withdrawn') out.push('withdrawn');
  return out;
}

/**
 * Column-based dates for activity that happened before event tracking began.
 * Under offer has no column, so it relies on events only.
 */
function columnDates(row: Row): Partial<Record<DisposalsAiBucket, string>> {
  const status = str(row.status);
  const out: Partial<Record<DisposalsAiBucket, string>> = {};
  const created = str(row.created_at);
  if (created && status !== 'draft') out.newInstructions = created;
  const onMarket = str(row.on_market_at);
  if (onMarket) out.launched = onMarket;
  const offMarket = str(row.off_market_at);
  if (offMarket && (status === 'let' || status === 'sold')) {
    out.completed = offMarket;
  }
  if (offMarket && status === 'withdrawn') out.withdrawn = offMarket;
  return out;
}

function durationMs(period: DisposalsAiPeriod): number {
  return new Date(period.to).getTime() - new Date(period.from).getTime();
}

function within(iso: string, period: DisposalsAiPeriod): boolean {
  const t = new Date(iso).getTime();
  return (
    Number.isFinite(t) &&
    t >= new Date(period.from).getTime() &&
    t < new Date(period.to).getTime()
  );
}

function buildPeriodFacts(params: {
  listingsById: Map<string, Row>;
  events: DisposalsAiEvent[];
  period: DisposalsAiPeriod;
  historyStart: string | null;
}): DisposalsAiPeriodFacts {
  const { listingsById, period, historyStart } = params;
  const historyStartMs = historyStart
    ? new Date(historyStart).getTime()
    : Number.POSITIVE_INFINITY;

  const hits = new Map<DisposalsAiBucket, Map<string, string>>(
    DISPOSALS_AI_BUCKETS.map((bucket) => [bucket, new Map()]),
  );

  const record = (bucket: DisposalsAiBucket, listingId: string, at: string) => {
    const bucketHits = hits.get(bucket)!;
    const existing = bucketHits.get(listingId);
    if (!existing || at < existing) bucketHits.set(listingId, at);
  };

  for (const event of params.events) {
    if (!listingsById.has(event.listingId)) continue;
    if (!within(event.createdAt, period)) continue;
    for (const bucket of eventBuckets(event)) {
      record(bucket, event.listingId, event.createdAt);
    }
  }

  for (const [id, row] of listingsById) {
    for (const [bucket, at] of Object.entries(columnDates(row)) as Array<
      [DisposalsAiBucket, string]
    >) {
      if (new Date(at).getTime() >= historyStartMs) continue;
      if (within(at, period)) record(bucket, id, at);
    }
  }

  const activity = {} as Record<DisposalsAiBucket, DisposalsAiBucketFacts>;
  for (const bucket of DISPOSALS_AI_BUCKETS) {
    const entries = [...hits.get(bucket)!.entries()].sort((a, b) =>
      b[1].localeCompare(a[1]),
    );
    const byPropertyType: Record<string, number> = {};
    for (const [id] of entries) {
      const type = str(listingsById.get(id)?.sector) ?? 'Unspecified';
      byPropertyType[type] = (byPropertyType[type] ?? 0) + 1;
    }
    activity[bucket] = {
      count: entries.length,
      byPropertyType,
      items: entries
        .slice(0, MAX_ITEMS_PER_BUCKET)
        .map(([id, at]) => toPublicItem(listingsById.get(id)!, at)),
    };
  }

  return {
    period,
    limitedHistory:
      !historyStart || new Date(period.from).getTime() < historyStartMs,
    activity,
  };
}

/**
 * Aggregate access-filtered disposals and their status events into the
 * compact, public-safe facts the assistant answers from.
 */
export function buildDisposalsAiFacts(params: {
  listings: Row[];
  events: DisposalsAiEvent[];
  period: DisposalsAiPeriod;
  comparison: DisposalsAiPeriod | null;
  historyStart: string | null;
  now: Date;
}): DisposalsAiFacts {
  const listingsById = new Map<string, Row>();
  for (const row of params.listings) {
    const id = str(row.id);
    if (id) listingsById.set(id, row);
  }

  const shared = {
    listingsById,
    events: params.events,
    historyStart: params.historyStart,
  };
  const period = buildPeriodFacts({ ...shared, period: params.period });
  const comparison = params.comparison
    ? buildPeriodFacts({ ...shared, period: params.comparison })
    : null;

  const byStatus: Record<string, number> = {};
  for (const status of LISTING_STATUSES) {
    byStatus[LISTING_STATUS_LABELS[status]] = 0;
  }
  let liveDisposals = 0;
  for (const row of listingsById.values()) {
    const label = statusLabel(row.status);
    byStatus[label] = (byStatus[label] ?? 0) + 1;
    if (row.status === 'marketing' || row.status === 'under_offer') {
      liveDisposals += 1;
    }
  }

  const dataNotes: string[] = [];
  const limited = [period, comparison].filter(
    (facts): facts is DisposalsAiPeriodFacts => Boolean(facts?.limitedHistory),
  );
  if (limited.length) {
    dataNotes.push(
      `Status history is only tracked from ${
        params.historyStart
          ? dayFormatter.format(new Date(params.historyStart))
          : 'recently'
      }. For ${limited
        .map((facts) => facts.period.label)
        .join(
          ' and ',
        )}, new instructions, launches and completions use record dates, and "went under offer" may be undercounted.`,
    );
  }
  if (params.period.partial) {
    dataNotes.push(
      `${params.period.label} is still in progress, so figures are to date.`,
    );
  }
  if (
    params.comparison &&
    params.period.partial &&
    durationMs(params.comparison) > durationMs(params.period) + DAY_MS
  ) {
    dataNotes.push(
      'The comparison period is a full period while the main period is partial.',
    );
  }

  return {
    generatedOn: params.now.toISOString().slice(0, 10),
    period,
    comparison,
    currentSnapshot: { byStatus, liveDisposals },
    dataNotes,
  };
}
