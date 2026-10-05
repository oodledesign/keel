import { z } from 'zod';

import {
  COMMERCIAL_SPACE,
  pounds,
  scopeWorkspaces,
} from './property-workspaces';
import {
  assertSupabaseOk,
  loadUserWorkspaces,
  pickDefined,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

/*
 * Match scoring mirrors apps/web/lib/commercial/match-scoring.ts (this
 * package cannot import from apps/web). Keep the weights in sync.
 */

export type MatchListing = {
  id: string;
  name: string;
  sector: string | null;
  disposalType: string;
  town: string | null;
  postcode: string | null;
  addressLine1: string | null;
  latitude: number | null;
  longitude: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  askingRentPence: number | null;
  askingRentToPence: number | null;
  askingPricePence: number | null;
};

export type MatchRequirement = {
  id: string;
  companyName: string | null;
  contactName: string | null;
  sector: string | null;
  tenure: string | null;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  searchRadiusMiles: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  budgetMinPence: number | null;
  budgetMaxPence: number | null;
};

const WEIGHTS = {
  sector: 25,
  size: 25,
  location: 20,
  tenure: 15,
  budget: 15,
} as const;

const SECTOR_ALIASES: Record<string, string> = {
  industrial: 'industrial',
  warehouse: 'industrial',
  logistics: 'industrial',
  distribution: 'industrial',
  office: 'office',
  offices: 'office',
  retail: 'retail',
  shop: 'retail',
  leisure: 'leisure',
  mixed: 'mixed',
  'mixed use': 'mixed',
  land: 'land',
};

const lets = (type: string) =>
  type === 'to_let' || type === 'to_let_and_for_sale';
const sells = (type: string) =>
  type === 'for_sale' ||
  type === 'investment' ||
  type === 'to_let_and_for_sale';

function tokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);
}

function normalizeSector(value: string | null | undefined) {
  const raw = value?.trim().toLowerCase() ?? '';
  return raw ? (SECTOR_ALIASES[raw] ?? raw) : null;
}

function rangeOverlap(
  aMin: number | null,
  aMax: number | null,
  bMin: number | null,
  bMax: number | null,
): number | null {
  if (aMin == null && aMax == null) return null;
  if (bMin == null && bMax == null) return null;
  const aLo = aMin ?? aMax ?? 0;
  const aHi = aMax ?? aMin ?? aLo;
  const bLo = bMin ?? bMax ?? 0;
  const bHi = bMax ?? bMin ?? bLo;
  const overlap = Math.max(0, Math.min(aHi, bHi) - Math.max(aLo, bLo));
  if (overlap > 0) {
    const union = Math.max(aHi, bHi) - Math.min(aLo, bLo);
    return Math.min(1, overlap / Math.max(1, union));
  }
  const aMid = (aLo + aHi) / 2;
  const bMid = (bLo + bHi) / 2;
  const distance = Math.abs(aMid - bMid) / Math.max(aMid, bMid, 1);
  if (distance <= 0.25) return 0.45;
  if (distance <= 0.5) return 0.2;
  return 0;
}

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.7613 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function withinBudget(amount: number, min: number | null, max: number | null) {
  if (min == null && max == null) return 'unknown';
  if (min != null && max != null) {
    if (amount >= min && amount <= max) return 'in';
    const span = Math.max(max - min, max * 0.1, 1);
    return amount >= min - span * 0.2 && amount <= max + span * 0.2
      ? 'near'
      : 'out';
  }
  if (max != null) {
    return amount <= max ? 'in' : amount <= max * 1.15 ? 'near' : 'out';
  }
  const lo = min as number;
  return amount >= lo ? 'in' : amount >= lo * 0.85 ? 'near' : 'out';
}

export function scoreMatch(listing: MatchListing, req: MatchRequirement) {
  const reasons: string[] = [];

  const a = normalizeSector(listing.sector);
  const b = normalizeSector(req.sector);
  let sector = Math.round(0.15 * WEIGHTS.sector);
  if (a && b) {
    if (a === b) {
      sector = WEIGHTS.sector;
      reasons.push(`Sector match (${listing.sector})`);
    } else if (a.includes(b) || b.includes(a)) {
      sector = Math.round(WEIGHTS.sector * 0.7);
      reasons.push(`Related sector (${listing.sector} ≈ ${req.sector})`);
    } else sector = 0;
  }

  const overlap = rangeOverlap(
    listing.sizeMinSqft,
    listing.sizeMaxSqft,
    req.sizeMinSqft,
    req.sizeMaxSqft,
  );
  let size = Math.round(0.15 * WEIGHTS.size);
  if (overlap != null) {
    size =
      overlap === 0 ? 0 : Math.round(WEIGHTS.size * (0.25 + 0.75 * overlap));
    if (overlap >= 0.85) reasons.push('Size band overlaps well');
    else if (overlap >= 0.45) reasons.push('Partial size overlap');
    else if (overlap > 0) reasons.push('Size is close');
  }

  let location = 0;
  const hasCoords = [
    listing.latitude,
    listing.longitude,
    req.latitude,
    req.longitude,
  ].every((v) => v != null && Number.isFinite(v));
  const radius =
    req.searchRadiusMiles == null || !Number.isFinite(req.searchRadiusMiles)
      ? null
      : req.searchRadiusMiles <= 0
        ? 0.5
        : req.searchRadiusMiles;
  let decided = false;
  if (hasCoords) {
    const miles = haversineMiles(
      req.latitude as number,
      req.longitude as number,
      listing.latitude as number,
      listing.longitude as number,
    );
    if (radius != null && radius > 0) {
      decided = true;
      if (miles <= radius) {
        location = WEIGHTS.location;
        reasons.push(
          `Within ${radius} mi search radius (${miles.toFixed(1)} mi)`,
        );
      } else reasons.push('Outside search radius');
    } else if (miles <= 5) {
      decided = true;
      location = WEIGHTS.location;
      reasons.push(`Close by (${miles.toFixed(1)} mi)`);
    } else if (miles <= 15) {
      decided = true;
      location = Math.round(WEIGHTS.location * 0.5);
      reasons.push(`Nearby (${miles.toFixed(1)} mi)`);
    }
  }
  if (!decided) {
    const reqTokens = new Set(tokens(req.locationText));
    if (reqTokens.size === 0) location = Math.round(0.15 * WEIGHTS.location);
    else {
      const bits = [
        listing.town,
        listing.postcode,
        listing.addressLine1,
        listing.name,
      ].flatMap((v) => tokens(v));
      if (bits.length === 0) location = Math.round(0.12 * WEIGHTS.location);
      else {
        const hits = bits.filter((t) => reqTokens.has(t));
        if (hits.length > 0) {
          const strong = hits.some(
            (t) =>
              tokens(listing.town).includes(t) ||
              tokens(listing.postcode).includes(t),
          );
          location = strong
            ? WEIGHTS.location
            : Math.round(WEIGHTS.location * 0.55);
          reasons.push(
            strong
              ? `Location fit (${hits.slice(0, 2).join(', ')})`
              : 'Soft location overlap',
          );
        }
      }
    }
  }

  let tenure = Math.round(0.2 * WEIGHTS.tenure);
  if (req.tenure === 'both') {
    tenure = WEIGHTS.tenure;
    reasons.push('Tenure flexible (rent or buy)');
  } else if (req.tenure === 'rent') {
    tenure = lets(listing.disposalType) ? WEIGHTS.tenure : 0;
    if (tenure) reasons.push('To let matches rent brief');
  } else if (req.tenure === 'buy') {
    tenure = sells(listing.disposalType) ? WEIGHTS.tenure : 0;
    if (tenure) reasons.push('For sale matches buy brief');
  }

  let budget = Math.round(0.15 * WEIGHTS.budget);
  if (req.budgetMinPence != null || req.budgetMaxPence != null) {
    let best = 'unknown';
    const consider = (result: string) => {
      if (result === 'in') best = 'in';
      else if (result === 'near' && best !== 'in') best = 'near';
      else if (result === 'out' && best === 'unknown') best = 'out';
    };
    if (req.tenure == null || req.tenure === 'rent' || req.tenure === 'both') {
      for (const rent of [listing.askingRentPence, listing.askingRentToPence]) {
        if (rent != null && rent > 0) {
          consider(withinBudget(rent, req.budgetMinPence, req.budgetMaxPence));
        }
      }
    }
    if (req.tenure == null || req.tenure === 'buy' || req.tenure === 'both') {
      if (listing.askingPricePence != null && listing.askingPricePence > 0) {
        consider(
          withinBudget(
            listing.askingPricePence,
            req.budgetMinPence,
            req.budgetMaxPence,
          ),
        );
      }
    }
    if (best === 'in') {
      budget = WEIGHTS.budget;
      reasons.push('Within budget');
    } else if (best === 'near') {
      budget = Math.round(WEIGHTS.budget * 0.55);
      reasons.push('Near budget');
    } else if (best === 'out') budget = 0;
  }

  const breakdown = { sector, size, location, tenure, budget };

  if (req.tenure === 'rent' && !lets(listing.disposalType)) {
    return {
      score: Math.min(20, sector + size),
      reasons: ['Tenure mismatch (rent vs for sale)'],
      breakdown,
    };
  }
  if (req.tenure === 'buy' && !sells(listing.disposalType)) {
    return {
      score: Math.min(20, sector + size),
      reasons: ['Tenure mismatch (buy vs to let)'],
      breakdown,
    };
  }

  return {
    score: Math.max(
      0,
      Math.min(100, sector + size + location + tenure + budget),
    ),
    reasons: reasons.slice(0, 4),
    breakdown,
  };
}

const num = (v: unknown) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type Row = Record<string, unknown>;

export function toListing(row: Row): MatchListing {
  return {
    id: row.id as string,
    name: (row.name as string) ?? 'Disposal',
    sector: (row.sector as string | null) ?? null,
    disposalType: (row.disposal_type as string) ?? 'to_let',
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    addressLine1: (row.address_line_1 as string | null) ?? null,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    askingRentPence: num(row.asking_rent_pence),
    askingRentToPence: num(row.asking_rent_to_pence),
    askingPricePence: num(row.asking_price_pence),
  };
}

export function toRequirement(row: Row): MatchRequirement {
  return {
    id: row.id as string,
    companyName: (row.company_name as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    sector: (row.sector as string | null) ?? null,
    tenure: (row.tenure as string | null) ?? null,
    locationText: (row.location_text as string | null) ?? null,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    searchRadiusMiles: num(row.search_radius_miles),
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    budgetMinPence: num(row.budget_min_pence),
    budgetMaxPence: num(row.budget_max_pence),
  };
}

export const MATCH_STATUSES = [
  'new',
  'shortlisted',
  'enquiry',
  'viewing_arranged',
  'viewing',
  'viewed',
  'offer_made',
  'negotiating',
  'under_offer',
  'agreed',
  'signed',
  'discounted',
  'idle',
  'withdrawn',
  'lost',
] as const;

const accountId = z.string().uuid().optional();

export const getRequirementSchema = z.object({ id: z.string().uuid() });
export const listMatchesSchema = z.object({
  account_id: accountId,
  listing_id: z.string().uuid().optional(),
  requirement_id: z.string().uuid().optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  limit: z.number().int().min(1).max(200).optional().default(100),
});
export const suggestMatchesSchema = z
  .object({
    requirement_id: z
      .string()
      .uuid()
      .optional()
      .describe('Find disposals that fit this requirement.'),
    listing_id: z
      .string()
      .uuid()
      .optional()
      .describe('Find requirements that fit this disposal.'),
    min_score: z.number().int().min(0).max(100).optional().default(40),
    limit: z.number().int().min(1).max(100).optional().default(20),
  })
  .refine(
    (v) => Boolean(v.requirement_id) !== Boolean(v.listing_id),
    'Provide exactly one of requirement_id or listing_id.',
  );
export const createMatchSchema = z.object({
  listing_id: z.string().uuid(),
  requirement_id: z.string().uuid(),
  status: z.enum(MATCH_STATUSES).optional().default('new'),
  notes: z.string().max(5000).optional(),
});
export const updateMatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(MATCH_STATUSES).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const LISTING_SELECT =
  'id, account_id, name, sector, disposal_type, town, postcode, address_line_1, latitude, longitude, size_min_sqft, size_max_sqft, asking_rent_pence, asking_rent_to_pence, asking_price_pence, status';
const REQUIREMENT_SELECT =
  'id, account_id, company_name, contact_name, contact_email, contact_phone, sector, tenure, location_text, latitude, longitude, search_radius_miles, size_min_sqft, size_max_sqft, budget_min_pence, budget_max_pence, notes, stage';

const ACTIVE_LISTING_STATUSES = ['instructed', 'marketing', 'under_offer'];
const ACTIVE_REQUIREMENT_STAGES = [
  'new',
  'actively_searching',
  'under_offer_negotiating',
];

export const registerCommercialMatchingTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  const scope = async (requested?: string) =>
    scopeWorkspaces(
      await loadUserWorkspaces(supabase, userId),
      COMMERCIAL_SPACE,
      requested,
    ).map((w) => w.id);

  const label = (r: Row) =>
    (r.company_name as string) || (r.contact_name as string) || 'Requirement';

  async function listingNames(ids: string[]) {
    const out = new Map<string, string>();
    if (ids.length === 0) return out;
    const { data } = await supabase
      .from('commercial_listings')
      .select('id, name, address_line_1, town, status')
      .in('id', ids);
    for (const l of (data ?? []) as Row[]) {
      out.set(
        l.id as string,
        [l.name, l.town].filter(Boolean).join(', ') || String(l.id),
      );
    }
    return out;
  }

  async function requirementNames(ids: string[]) {
    const out = new Map<string, string>();
    if (ids.length === 0) return out;
    const { data } = await supabase
      .from('commercial_requirements')
      .select('id, company_name, contact_name')
      .in('id', ids);
    for (const r of (data ?? []) as Row[]) out.set(r.id as string, label(r));
    return out;
  }

  server.registerTool(
    'get_requirement',
    {
      description:
        'One applicant requirement in full (contact, brief, size, budget, stage, notes) with the disposals already matched to it (and their status) and its WIP deals.',
      inputSchema: getRequirementSchema,
    },
    async (input) => {
      const ids = await scope();
      const { data, error } = await supabase
        .from('commercial_requirements')
        .select('*')
        .eq('id', input.id)
        .in('account_id', ids)
        .maybeSingle();
      assertSupabaseOk(data, error, 'get requirement');
      if (!data) throw new Error('Requirement not found');
      const row = data as Row;
      const [matches, deals, viewings] = await Promise.all([
        supabase
          .from('commercial_matches')
          .select('id, listing_id, status, notes, last_activity_at')
          .eq('requirement_id', input.id),
        supabase
          .from('pipeline_deals')
          .select(
            'id, name, stage, work_type, value, next_action, next_action_date',
          )
          .eq('commercial_requirement_id', input.id)
          .is('archived_at', null),
        supabase
          .from('commercial_viewings')
          .select('id, listing_id, scheduled_at, status, outcome, feedback')
          .eq('requirement_id', input.id)
          .order('scheduled_at', { ascending: false }),
      ]);
      const matchRows = (matches.data ?? []) as Row[];
      const names = await listingNames([
        ...new Set([
          ...matchRows.map((m) => m.listing_id as string),
          ...((viewings.data ?? []) as Row[]).map(
            (v) => v.listing_id as string,
          ),
        ]),
      ]);
      return toolJson({
        requirement: {
          ...row,
          budget_min_gbp: pounds(row.budget_min_pence as number | null),
          budget_max_gbp: pounds(row.budget_max_pence as number | null),
        },
        matches: matchRows.map((m) => ({
          ...m,
          listing: names.get(m.listing_id as string) ?? null,
        })),
        viewings: ((viewings.data ?? []) as Row[]).map((v) => ({
          ...v,
          listing: names.get(v.listing_id as string) ?? null,
        })),
        wip_deals: deals.data ?? [],
      });
    },
  );

  server.registerTool(
    'list_matches',
    {
      description:
        'The interest schedule: recorded matches between disposals and requirements with their status (new, shortlisted, viewing_arranged, viewed, offer_made, negotiating, under_offer, agreed, withdrawn, lost…) and notes. Filter by listing_id, requirement_id or status.',
      inputSchema: listMatchesSchema,
    },
    async (input) => {
      const ids = await scope(input.account_id);
      let query = supabase
        .from('commercial_matches')
        .select(
          'id, account_id, listing_id, requirement_id, status, notes, last_activity_at, created_at',
        )
        .in('account_id', ids)
        .order('last_activity_at', { ascending: false })
        .limit(input.limit);
      if (input.listing_id) query = query.eq('listing_id', input.listing_id);
      if (input.requirement_id) {
        query = query.eq('requirement_id', input.requirement_id);
      }
      if (input.status) query = query.eq('status', input.status);
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list matches');
      const rows = (data ?? []) as Row[];
      const [ln, rn] = await Promise.all([
        listingNames([...new Set(rows.map((r) => r.listing_id as string))]),
        requirementNames([
          ...new Set(rows.map((r) => r.requirement_id as string)),
        ]),
      ]);
      return toolJson({
        count: rows.length,
        matches: rows.map((r) => ({
          ...r,
          listing: ln.get(r.listing_id as string) ?? null,
          requirement: rn.get(r.requirement_id as string) ?? null,
        })),
      });
    },
  );

  server.registerTool(
    'suggest_matches',
    {
      description:
        'Score likely fits (0–100, same scoring as the app: sector 25, size 25, location 20, tenure 15, budget 15). Give a requirement_id to find disposals for it (instructed, marketing or under-offer), or a listing_id to find requirements for it. Returns score, reasons and breakdown, and flags pairs that are already matched. Does not save anything; use create_match to record one.',
      inputSchema: suggestMatchesSchema,
    },
    async (input) => {
      const ids = await scope();
      if (input.requirement_id) {
        const { data: reqRow, error } = await supabase
          .from('commercial_requirements')
          .select(REQUIREMENT_SELECT)
          .eq('id', input.requirement_id)
          .in('account_id', ids)
          .maybeSingle();
        assertSupabaseOk(reqRow, error, 'get requirement');
        if (!reqRow) throw new Error('Requirement not found');
        const req = toRequirement(reqRow as Row);
        const accountForReq = (reqRow as Row).account_id as string;
        const [{ data: listings }, { data: existing }] = await Promise.all([
          supabase
            .from('commercial_listings')
            .select(LISTING_SELECT)
            .eq('account_id', accountForReq)
            .in('status', ACTIVE_LISTING_STATUSES)
            .limit(1000),
          supabase
            .from('commercial_matches')
            .select('listing_id')
            .eq('requirement_id', req.id),
        ]);
        const matched = new Set(
          ((existing ?? []) as Row[]).map((m) => m.listing_id as string),
        );
        const results = ((listings ?? []) as Row[])
          .map((l) => {
            const listing = toListing(l);
            return {
              listing_id: listing.id,
              listing: [listing.name, listing.town].filter(Boolean).join(', '),
              disposal_type: listing.disposalType,
              already_matched: matched.has(listing.id),
              ...scoreMatch(listing, req),
            };
          })
          .filter((r) => r.score >= input.min_score)
          .sort((a, b) => b.score - a.score)
          .slice(0, input.limit);
        return toolJson({
          requirement: label(reqRow as Row),
          count: results.length,
          suggestions: results,
        });
      }

      const { data: listingRow, error } = await supabase
        .from('commercial_listings')
        .select(LISTING_SELECT)
        .eq('id', input.listing_id as string)
        .in('account_id', ids)
        .maybeSingle();
      assertSupabaseOk(listingRow, error, 'get disposal');
      if (!listingRow) throw new Error('Disposal not found');
      const listing = toListing(listingRow as Row);
      const accountForListing = (listingRow as Row).account_id as string;
      const [{ data: reqs }, { data: existing }] = await Promise.all([
        supabase
          .from('commercial_requirements')
          .select(REQUIREMENT_SELECT)
          .eq('account_id', accountForListing)
          .is('archived_at', null)
          .in('stage', ACTIVE_REQUIREMENT_STAGES)
          .limit(1000),
        supabase
          .from('commercial_matches')
          .select('requirement_id')
          .eq('listing_id', listing.id),
      ]);
      const matched = new Set(
        ((existing ?? []) as Row[]).map((m) => m.requirement_id as string),
      );
      const results = ((reqs ?? []) as Row[])
        .map((r) => {
          const req = toRequirement(r);
          return {
            requirement_id: req.id,
            requirement: label(r),
            contact_email: r.contact_email ?? null,
            already_matched: matched.has(req.id),
            ...scoreMatch(listing, req),
          };
        })
        .filter((r) => r.score >= input.min_score)
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit);
      return toolJson({
        disposal: listing.name,
        count: results.length,
        suggestions: results,
      });
    },
  );

  server.registerTool(
    'create_match',
    {
      description:
        'Record a match between a disposal and a requirement on the interest schedule (default status new). Fails if the pair already exists; use update_match instead.',
      inputSchema: createMatchSchema,
    },
    async (input) => {
      const ids = await scope();
      const [listing, requirement] = await Promise.all([
        supabase
          .from('commercial_listings')
          .select('id, account_id')
          .eq('id', input.listing_id)
          .in('account_id', ids)
          .maybeSingle(),
        supabase
          .from('commercial_requirements')
          .select('id, account_id')
          .eq('id', input.requirement_id)
          .in('account_id', ids)
          .maybeSingle(),
      ]);
      assertSupabaseOk(listing.data, listing.error, 'get disposal');
      assertSupabaseOk(requirement.data, requirement.error, 'get requirement');
      const l = listing.data as Row | null;
      const r = requirement.data as Row | null;
      if (!l) throw new Error('Disposal not found');
      if (!r) throw new Error('Requirement not found');
      if (l.account_id !== r.account_id) {
        throw new Error('Disposal and requirement are in different workspaces');
      }
      const { data: existing } = await supabase
        .from('commercial_matches')
        .select('id')
        .eq('listing_id', input.listing_id)
        .eq('requirement_id', input.requirement_id)
        .maybeSingle();
      if (existing) {
        throw new Error(
          `Already matched (match ${(existing as Row).id}); use update_match.`,
        );
      }
      const { data, error } = await supabase
        .from('commercial_matches')
        .insert({
          account_id: l.account_id,
          listing_id: input.listing_id,
          requirement_id: input.requirement_id,
          status: input.status,
          notes: input.notes ?? null,
          created_by: userId,
        })
        .select(
          'id, listing_id, requirement_id, status, notes, last_activity_at',
        )
        .single();
      assertSupabaseOk(data, error, 'create match');
      return toolJson({ match: data });
    },
  );

  server.registerTool(
    'update_match',
    {
      description:
        'Change a match status (e.g. shortlisted → viewing_arranged → offer_made → agreed) or its notes.',
      inputSchema: updateMatchSchema,
    },
    async (input) => {
      const ids = await scope();
      const patch = pickDefined({
        status: input.status,
        notes: input.notes,
        last_activity_at: new Date().toISOString(),
      });
      if (input.status === undefined && input.notes === undefined) {
        throw new Error('Provide status and/or notes');
      }
      const { data, error } = await supabase
        .from('commercial_matches')
        .update(patch)
        .eq('id', input.id)
        .in('account_id', ids)
        .select(
          'id, listing_id, requirement_id, status, notes, last_activity_at',
        )
        .maybeSingle();
      assertSupabaseOk(data, error, 'update match');
      if (!data) throw new Error('Match not found');
      return toolJson({ match: data });
    },
  );
};
