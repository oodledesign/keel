import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  type McpWorkspace,
  assertSupabaseOk,
  loadUserWorkspaces,
  pickDefined,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

export const COMMERCIAL_SPACE = 'commercial-property';
export const SURVEYOR_SPACE = 'building-surveyor';

/** Work-in-progress stages used on the pipeline board (agency, professional, management). */
export const WIP_STAGES = [
  'potential',
  'current',
  'negotiating',
  'under_offer',
  'under_offer_negotiating',
  'completed_exchanged',
  'completed',
  'billed',
  'managed',
  'fallen_through',
] as const;
const WIP_CLOSED = ['billed', 'fallen_through', 'completed_exchanged'];

export const LISTING_STATUSES = [
  'draft',
  'instructed',
  'marketing',
  'under_offer',
  'let',
  'sold',
  'withdrawn',
] as const;

const accountId = z
  .string()
  .uuid()
  .optional()
  .describe(
    'Workspace id from list_workspaces. Omit to search every matching workspace you belong to.',
  );
const limit = z.number().int().min(1).max(200).optional().default(50);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const listDisposalsSchema = z.object({
  account_id: accountId,
  status: z
    .enum(LISTING_STATUSES)
    .optional()
    .describe('Omit for everything except withdrawn.'),
  include_withdrawn: z.boolean().optional().default(false),
  disposal_type: z
    .enum(['to_let', 'for_sale', 'to_let_and_for_sale', 'investment'])
    .optional(),
  search: z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe('Matches name, address, town, postcode or reference.'),
  assigned_to: z.string().uuid().optional(),
  limit,
});
export const getDisposalSchema = z.object({ id: z.string().uuid() });
export const updateDisposalSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(LISTING_STATUSES).optional(),
  notes: z.string().max(20000).nullable().optional(),
  available_from: ymd.nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const listViewingsSchema = z.object({
  account_id: accountId,
  listing_id: z.string().uuid().optional(),
  status: z.enum(['upcoming', 'awaiting_feedback', 'completed']).optional(),
  from: ymd.optional(),
  to: ymd.optional(),
  limit,
});
export const listEnquiriesSchema = z.object({
  account_id: accountId,
  listing_id: z.string().uuid().optional(),
  status: z.string().trim().max(40).optional(),
  limit,
});
export const listRequirementsSchema = z.object({
  account_id: accountId,
  stage: z.string().trim().max(40).optional(),
  search: z.string().trim().max(80).optional(),
  include_archived: z.boolean().optional().default(false),
  limit,
});
export const listLeasesSchema = z.object({
  account_id: accountId,
  expiring_within_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .describe(
      'Only leases ending within this many days (and not already past).',
    ),
  status: z.string().trim().max(40).optional(),
  limit,
});

export const listWipSchema = z.object({
  account_id: accountId,
  work_type: z
    .enum(['agency', 'professional', 'management'])
    .optional()
    .describe('WIP lane. Omit for all.'),
  stage: z.enum(WIP_STAGES).optional(),
  include_closed: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include billed / fallen through / completed-exchanged.'),
  search: z.string().trim().max(80).optional(),
  limit,
});
export const getWipDealSchema = z.object({ id: z.string().uuid() });
export const updateWipDealSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(WIP_STAGES).optional(),
  next_action: z.string().max(500).nullable().optional(),
  next_action_date: ymd.nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  follow_up_call: z.boolean().optional(),
});

export const propertySummarySchema = z.object({ account_id: accountId });

export const listSurveysSchema = z.object({
  account_id: accountId,
  status: z.string().trim().max(40).optional(),
  search: z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe('Matches title, property address, postcode or report reference.'),
  inspected_from: ymd.optional(),
  inspected_to: ymd.optional(),
  limit,
});
export const getSurveySchema = z.object({ id: z.string().uuid() });

/** Strip characters that would break a PostgREST `or()` filter. */
export function safeSearch(value: string): string {
  return value
    .replace(/[%,()*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pounds(pence: number | string | null | undefined) {
  if (pence == null) return null;
  const n = Number(pence);
  return Number.isFinite(n) ? n / 100 : null;
}

export function scopeWorkspaces(
  workspaces: McpWorkspace[],
  spaceType: string,
  requested?: string,
): McpWorkspace[] {
  const matching = workspaces.filter((w) => w.space_type === spaceType);
  const label =
    spaceType === COMMERCIAL_SPACE
      ? 'commercial property'
      : spaceType === SURVEYOR_SPACE
        ? 'building surveyor'
        : spaceType;
  if (requested) {
    const found = matching.find((w) => w.id === requested);
    if (!found) {
      throw new Error(
        `That workspace is not a ${label} workspace you belong to.`,
      );
    }
    return [found];
  }
  if (matching.length === 0) {
    throw new Error(`You do not belong to a ${label} workspace.`);
  }
  return matching;
}

/** WIP is shared by both property workspace types. */
export function scopeWipWorkspaces(
  workspaces: McpWorkspace[],
  requested?: string,
): McpWorkspace[] {
  const matching = workspaces.filter(
    (w) => w.space_type === COMMERCIAL_SPACE || w.space_type === SURVEYOR_SPACE,
  );
  if (requested) {
    const found = matching.find((w) => w.id === requested);
    if (!found) {
      throw new Error(
        'That workspace is not a commercial or surveyor workspace you belong to.',
      );
    }
    return [found];
  }
  if (matching.length === 0) {
    throw new Error('You do not belong to a commercial or surveyor workspace.');
  }
  return matching;
}

type Row = Record<string, unknown>;

async function namesFor(
  supabase: SupabaseClient,
  table: 'accounts' | 'clients',
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const columns =
    table === 'accounts' ? 'id, name' : 'id, display_name, company_name';
  const { data } = await supabase.from(table).select(columns).in('id', unique);
  for (const row of (data ?? []) as unknown as Row[]) {
    const name =
      (row.display_name as string | null) ||
      (row.company_name as string | null) ||
      (row.name as string | null);
    if (row.id && name) out.set(row.id as string, name.trim());
  }
  return out;
}

export function mapDisposal(
  row: Row,
  people: Map<string, string>,
  clients: Map<string, string>,
) {
  return {
    id: row.id,
    account_id: row.account_id,
    reference: row.reference_number ?? null,
    name: row.name ?? null,
    address: [row.address_line_1, row.town, row.postcode]
      .filter(Boolean)
      .join(', '),
    status: row.status,
    disposal_type: row.disposal_type ?? null,
    sector: row.sector ?? null,
    tenure: row.tenure ?? null,
    size_sqft: {
      min: row.size_min_sqft ?? null,
      max: row.size_max_sqft ?? null,
    },
    asking_rent_gbp: pounds(row.asking_rent_pence as number | null),
    asking_rent_to_gbp: pounds(row.asking_rent_to_pence as number | null),
    rent_frequency: row.rent_frequency ?? null,
    asking_price_gbp: pounds(row.asking_price_pence as number | null),
    available_from: row.available_from ?? null,
    epc_band: row.epc_band ?? null,
    on_market_at: row.on_market_at ?? null,
    is_instructed: row.is_instructed ?? null,
    instructing_client:
      clients.get(row.instructing_client_id as string) ?? null,
    instructing_client_id: row.instructing_client_id ?? null,
    assigned_to: people.get(row.assigned_to as string) ?? null,
    assigned_to_id: row.assigned_to ?? null,
    updated_at: row.updated_at ?? null,
  };
}

const LISTING_LIST_SELECT =
  'id, account_id, reference_number, name, address_line_1, town, postcode, status, disposal_type, sector, tenure, size_min_sqft, size_max_sqft, asking_rent_pence, asking_rent_to_pence, rent_frequency, asking_price_pence, available_from, epc_band, on_market_at, is_instructed, instructing_client_id, assigned_to, updated_at';

const DEAL_SELECT =
  'id, account_id, name, company_name, contact_name, stage, work_type, value, probability, expected_close, next_action, next_action_date, notes, follow_up_call, aml_done, address_line_1, town, postcode, disposal_type, property_type, size_sqft, asking_rent_pence, asking_price_pence, commercial_listing_id, commercial_requirement_id, client_id, updated_at, completed_at';

function mapDeal(row: Row, clients: Map<string, string>) {
  return {
    id: row.id,
    account_id: row.account_id,
    name: row.name ?? row.company_name ?? row.contact_name ?? null,
    work_type: row.work_type ?? null,
    stage: row.stage ?? null,
    fee_gbp: row.value ?? null,
    probability: row.probability ?? null,
    expected_close: row.expected_close ?? null,
    next_action: row.next_action ?? null,
    next_action_date: row.next_action_date ?? null,
    notes: row.notes ?? null,
    follow_up_call: row.follow_up_call ?? null,
    aml_done: row.aml_done ?? null,
    property: {
      address: [row.address_line_1, row.town, row.postcode]
        .filter(Boolean)
        .join(', '),
      disposal_type: row.disposal_type ?? null,
      type: row.property_type ?? null,
      size_sqft: row.size_sqft ?? null,
      asking_rent_gbp: pounds(row.asking_rent_pence as number | null),
      asking_price_gbp: pounds(row.asking_price_pence as number | null),
    },
    client: clients.get(row.client_id as string) ?? null,
    client_id: row.client_id ?? null,
    listing_id: row.commercial_listing_id ?? null,
    requirement_id: row.commercial_requirement_id ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export const registerPropertyWorkspaceTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  const workspaces = () => loadUserWorkspaces(supabase, userId);
  const commercial = async (requested?: string) =>
    scopeWorkspaces(await workspaces(), COMMERCIAL_SPACE, requested);

  server.registerTool(
    'list_disposals',
    {
      description:
        'List disposals (listings / instructions) in a commercial property workspace: address, status, to-let / for-sale, size, asking rent or price, EPC, client and assigned agent. Hides withdrawn by default. Filter by status, disposal_type, search (name/address/postcode/reference) or assigned_to. Amounts are in pounds.',
      inputSchema: listDisposalsSchema,
    },
    async (input) => {
      const scope = await commercial(input.account_id);
      let query = supabase
        .from('commercial_listings')
        .select(LISTING_LIST_SELECT)
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .order('updated_at', { ascending: false })
        .limit(input.limit);
      if (input.status) query = query.eq('status', input.status);
      else if (!input.include_withdrawn) {
        query = query.neq('status', 'withdrawn');
      }
      if (input.disposal_type) {
        query = query.eq('disposal_type', input.disposal_type);
      }
      if (input.assigned_to) query = query.eq('assigned_to', input.assigned_to);
      const search = input.search ? safeSearch(input.search) : '';
      if (search) {
        const p = `%${search}%`;
        query = query.or(
          `name.ilike.${p},address_line_1.ilike.${p},town.ilike.${p},postcode.ilike.${p},reference_number.ilike.${p}`,
        );
      }
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list disposals');
      const rows = (data ?? []) as Row[];
      const [people, clients] = await Promise.all([
        namesFor(
          supabase,
          'accounts',
          rows.map((r) => r.assigned_to as string),
        ),
        namesFor(
          supabase,
          'clients',
          rows.map((r) => r.instructing_client_id as string),
        ),
      ]);
      return toolJson({
        count: rows.length,
        disposals: rows.map((r) => mapDisposal(r, people, clients)),
      });
    },
  );

  server.registerTool(
    'get_disposal',
    {
      description:
        'One disposal in full: description, terms, marketing details plus its viewings, enquiries and linked WIP deals.',
      inputSchema: getDisposalSchema,
    },
    async (input) => {
      const scope = await commercial();
      const ids = scope.map((w) => w.id);
      const { data, error } = await supabase
        .from('commercial_listings')
        .select('*')
        .eq('id', input.id)
        .in('account_id', ids)
        .maybeSingle();
      assertSupabaseOk(data, error, 'get disposal');
      if (!data) throw new Error('Disposal not found');
      const row = data as Row;
      const [viewings, enquiries, deals, people, clients] = await Promise.all([
        supabase
          .from('commercial_viewings')
          .select('id, scheduled_at, status, outcome, feedback')
          .eq('listing_id', input.id)
          .order('scheduled_at', { ascending: false })
          .limit(50),
        supabase
          .from('commercial_enquiries')
          .select(
            'id, status, contact_name, contact_email, contact_phone, message, source, received_at',
          )
          .eq('listing_id', input.id)
          .order('received_at', { ascending: false })
          .limit(50),
        supabase
          .from('pipeline_deals')
          .select(DEAL_SELECT)
          .eq('commercial_listing_id', input.id)
          .is('archived_at', null),
        namesFor(supabase, 'accounts', [row.assigned_to as string]),
        namesFor(supabase, 'clients', [row.instructing_client_id as string]),
      ]);
      return toolJson({
        disposal: {
          ...mapDisposal(row, people, clients),
          summary: row.summary ?? null,
          description: row.description ?? null,
          terms_internal: row.terms_internal ?? null,
          notes: row.notes ?? null,
          key_points: row.key_points ?? null,
          use_class: row.use_class ?? null,
          service_charge_per_sqft: row.service_charge_per_sqft ?? null,
          rates_payable_per_sqft: row.rates_payable_per_sqft ?? null,
          possession: row.possession ?? null,
          let_type: row.let_type ?? null,
          parking_spaces: row.parking_spaces ?? null,
        },
        viewings: viewings.data ?? [],
        enquiries: enquiries.data ?? [],
        wip_deals: ((deals.data ?? []) as Row[]).map((d) =>
          mapDeal(d, new Map()),
        ),
      });
    },
  );

  server.registerTool(
    'update_disposal',
    {
      description:
        'Safe edits to a disposal: status (draft, instructed, marketing, under_offer, let, sold, withdrawn), notes, available_from, assigned_to (a team member id). Does not change prices or rents. Only provided fields change.',
      inputSchema: updateDisposalSchema,
    },
    async (input) => {
      const scope = await commercial();
      const patch = pickDefined({
        status: input.status,
        notes: input.notes,
        available_from: input.available_from,
        assigned_to: input.assigned_to,
      });
      if (Object.keys(patch).length === 0) {
        throw new Error('Provide at least one field to update');
      }
      const { data, error } = await supabase
        .from('commercial_listings')
        .update(patch)
        .eq('id', input.id)
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .select(LISTING_LIST_SELECT)
        .maybeSingle();
      assertSupabaseOk(data, error, 'update disposal');
      if (!data) throw new Error('Disposal not found');
      return toolJson({
        disposal: mapDisposal(data as Row, new Map(), new Map()),
      });
    },
  );

  server.registerTool(
    'list_viewings',
    {
      description:
        'Viewings in a commercial workspace, soonest first. Filter by listing_id, status (upcoming, awaiting_feedback, completed) or a date range (from/to).',
      inputSchema: listViewingsSchema,
    },
    async (input) => {
      const scope = await commercial(input.account_id);
      let query = supabase
        .from('commercial_viewings')
        .select(
          'id, account_id, listing_id, requirement_id, client_id, scheduled_at, status, outcome, feedback, conducted_by',
        )
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .order('scheduled_at', { ascending: true })
        .limit(input.limit);
      if (input.listing_id) query = query.eq('listing_id', input.listing_id);
      if (input.status) query = query.eq('status', input.status);
      if (input.from) query = query.gte('scheduled_at', input.from);
      if (input.to) query = query.lte('scheduled_at', `${input.to}T23:59:59Z`);
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list viewings');
      const rows = (data ?? []) as Row[];
      const listingIds = [...new Set(rows.map((r) => r.listing_id as string))];
      const { data: listings } = listingIds.length
        ? await supabase
            .from('commercial_listings')
            .select('id, name, address_line_1, town')
            .in('id', listingIds)
        : { data: [] };
      const byId = new Map(
        ((listings ?? []) as Row[]).map((l) => [
          l.id as string,
          [l.name, l.address_line_1, l.town].filter(Boolean).join(', '),
        ]),
      );
      return toolJson({
        count: rows.length,
        viewings: rows.map((r) => ({
          ...r,
          listing: byId.get(r.listing_id as string) ?? null,
        })),
      });
    },
  );

  server.registerTool(
    'list_enquiries',
    {
      description:
        'Enquiries received on disposals (portal and manual), newest first, with contact details and message.',
      inputSchema: listEnquiriesSchema,
    },
    async (input) => {
      const scope = await commercial(input.account_id);
      let query = supabase
        .from('commercial_enquiries')
        .select(
          'id, account_id, listing_id, status, source, contact_name, contact_email, contact_phone, message, target_size_min_sqft, target_size_max_sqft, areas_text, received_at',
        )
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .order('received_at', { ascending: false })
        .limit(input.limit);
      if (input.listing_id) query = query.eq('listing_id', input.listing_id);
      if (input.status) query = query.eq('status', input.status);
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list enquiries');
      return toolJson({ count: data?.length ?? 0, enquiries: data ?? [] });
    },
  );

  server.registerTool(
    'list_requirements',
    {
      description:
        'Applicant requirements (what tenants / buyers are looking for): company, contact, sector, tenure, location, size and budget range, stage. Archived hidden by default.',
      inputSchema: listRequirementsSchema,
    },
    async (input) => {
      const scope = await commercial(input.account_id);
      let query = supabase
        .from('commercial_requirements')
        .select(
          'id, account_id, company_name, contact_name, contact_email, contact_phone, sector, tenure, location_text, size_min_sqft, size_max_sqft, budget_min_pence, budget_max_pence, stage, assigned_to, notes, updated_at',
        )
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .order('updated_at', { ascending: false })
        .limit(input.limit);
      if (!input.include_archived) query = query.is('archived_at', null);
      if (input.stage) query = query.eq('stage', input.stage);
      const search = input.search ? safeSearch(input.search) : '';
      if (search) {
        const p = `%${search}%`;
        query = query.or(
          `company_name.ilike.${p},contact_name.ilike.${p},location_text.ilike.${p}`,
        );
      }
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list requirements');
      return toolJson({
        count: data?.length ?? 0,
        requirements: ((data ?? []) as Row[]).map((r) => ({
          ...r,
          budget_min_gbp: pounds(r.budget_min_pence as number | null),
          budget_max_gbp: pounds(r.budget_max_pence as number | null),
        })),
      });
    },
  );

  server.registerTool(
    'list_commercial_leases',
    {
      description:
        'Lease / deal records (property, tenant, headline rent psf, start and end, status). Use expiring_within_days to find upcoming expiries.',
      inputSchema: listLeasesSchema,
    },
    async (input) => {
      const scope = await commercial(input.account_id);
      let query = supabase
        .from('commercial_leases')
        .select(
          'id, account_id, listing_id, property_label, town, postcode, tenant_name, headline_rent_psf, headline_price_pence, lease_start, lease_end, status, transaction_kind, notes',
        )
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .order('lease_end', { ascending: true, nullsFirst: false })
        .limit(input.limit);
      if (input.status) query = query.eq('status', input.status);
      if (input.expiring_within_days) {
        const today = new Date();
        const end = new Date(today);
        end.setUTCDate(end.getUTCDate() + input.expiring_within_days);
        query = query
          .gte('lease_end', today.toISOString().slice(0, 10))
          .lte('lease_end', end.toISOString().slice(0, 10));
      }
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list leases');
      return toolJson({
        count: data?.length ?? 0,
        leases: ((data ?? []) as Row[]).map((r) => ({
          ...r,
          headline_price_gbp: pounds(r.headline_price_pence as number | null),
        })),
      });
    },
  );

  server.registerTool(
    'list_wip',
    {
      description:
        'Work in progress (the pipeline board) for commercial and building-surveyor workspaces. Deals by lane (agency, professional, management) and stage (potential, current, negotiating, under_offer, completed_exchanged, billed, fallen_through, managed), with fee, property, client and next action. Closed stages are hidden unless include_closed is true.',
      inputSchema: listWipSchema,
    },
    async (input) => {
      const scope = scopeWipWorkspaces(await workspaces(), input.account_id);
      let query = supabase
        .from('pipeline_deals')
        .select(DEAL_SELECT)
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(input.limit);
      if (input.work_type) query = query.eq('work_type', input.work_type);
      if (input.stage) query = query.eq('stage', input.stage);
      else if (!input.include_closed) {
        query = query.not('stage', 'in', `(${WIP_CLOSED.join(',')})`);
      }
      const search = input.search ? safeSearch(input.search) : '';
      if (search) {
        const p = `%${search}%`;
        query = query.or(
          `name.ilike.${p},company_name.ilike.${p},address_line_1.ilike.${p},postcode.ilike.${p}`,
        );
      }
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list wip');
      const rows = (data ?? []) as Row[];
      const clients = await namesFor(
        supabase,
        'clients',
        rows.map((r) => r.client_id as string),
      );
      const totals: Record<string, { count: number; fee_gbp: number }> = {};
      for (const r of rows) {
        const key = `${r.work_type ?? 'other'}/${r.stage ?? 'none'}`;
        const t = (totals[key] ??= { count: 0, fee_gbp: 0 });
        t.count += 1;
        t.fee_gbp += Number(r.value ?? 0);
      }
      return toolJson({
        count: rows.length,
        totals_by_lane_and_stage: totals,
        deals: rows.map((r) => mapDeal(r, clients)),
      });
    },
  );

  server.registerTool(
    'get_wip_deal',
    {
      description: 'One WIP deal in full, with its linked disposal if any.',
      inputSchema: getWipDealSchema,
    },
    async (input) => {
      const scope = scopeWipWorkspaces(await workspaces());
      const { data, error } = await supabase
        .from('pipeline_deals')
        .select(DEAL_SELECT)
        .eq('id', input.id)
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .maybeSingle();
      assertSupabaseOk(data, error, 'get wip deal');
      if (!data) throw new Error('Deal not found');
      const row = data as Row;
      const clients = await namesFor(supabase, 'clients', [
        row.client_id as string,
      ]);
      return toolJson({ deal: mapDeal(row, clients) });
    },
  );

  server.registerTool(
    'update_wip_deal',
    {
      description:
        'Move a WIP deal or log progress: stage, next_action (text), next_action_date, notes, follow_up_call. Does not change fees or values. Only provided fields change.',
      inputSchema: updateWipDealSchema,
    },
    async (input) => {
      const scope = scopeWipWorkspaces(await workspaces());
      const patch = pickDefined({
        stage: input.stage,
        next_action: input.next_action,
        next_action_date: input.next_action_date,
        notes: input.notes,
        follow_up_call: input.follow_up_call,
      });
      if (Object.keys(patch).length === 0) {
        throw new Error('Provide at least one field to update');
      }
      const { data, error } = await supabase
        .from('pipeline_deals')
        .update(patch)
        .eq('id', input.id)
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .is('archived_at', null)
        .select(DEAL_SELECT)
        .maybeSingle();
      assertSupabaseOk(data, error, 'update wip deal');
      if (!data) throw new Error('Deal not found');
      return toolJson({ deal: mapDeal(data as Row, new Map()) });
    },
  );

  server.registerTool(
    'property_workspace_summary',
    {
      description:
        'Dashboard snapshot for commercial and surveyor workspaces: disposals by status, open WIP count and fees by lane and stage, viewings in the next 7 days, viewings awaiting feedback, leases ending within 90 days (commercial), and survey counts (surveyor).',
      inputSchema: propertySummarySchema,
    },
    async (input) => {
      const scope = scopeWipWorkspaces(await workspaces(), input.account_id);
      const result: Record<string, unknown> = {};
      for (const ws of scope) {
        const summary: Record<string, unknown> = {
          workspace: ws.name,
          space_type: ws.space_type,
        };

        const { data: deals } = await supabase
          .from('pipeline_deals')
          .select('work_type, stage, value')
          .eq('account_id', ws.id)
          .is('archived_at', null)
          .limit(5000);
        const wip: Record<string, { count: number; fee_gbp: number }> = {};
        for (const d of (deals ?? []) as Row[]) {
          if (WIP_CLOSED.includes(d.stage as string)) continue;
          const key = `${d.work_type ?? 'other'}/${d.stage ?? 'none'}`;
          const t = (wip[key] ??= { count: 0, fee_gbp: 0 });
          t.count += 1;
          t.fee_gbp += Number(d.value ?? 0);
        }
        summary.open_wip_by_lane_and_stage = wip;

        if (ws.space_type === COMMERCIAL_SPACE) {
          const today = new Date();
          const iso = (d: Date) => d.toISOString();
          const week = new Date(today);
          week.setUTCDate(week.getUTCDate() + 7);
          const ninety = new Date(today);
          ninety.setUTCDate(ninety.getUTCDate() + 90);
          const [listings, upcoming, awaiting, leases] = await Promise.all([
            supabase
              .from('commercial_listings')
              .select('status')
              .eq('account_id', ws.id)
              .limit(5000),
            supabase
              .from('commercial_viewings')
              .select('id', { count: 'exact', head: true })
              .eq('account_id', ws.id)
              .gte('scheduled_at', iso(today))
              .lte('scheduled_at', iso(week)),
            supabase
              .from('commercial_viewings')
              .select('id', { count: 'exact', head: true })
              .eq('account_id', ws.id)
              .eq('status', 'awaiting_feedback'),
            supabase
              .from('commercial_leases')
              .select('id', { count: 'exact', head: true })
              .eq('account_id', ws.id)
              .gte('lease_end', iso(today).slice(0, 10))
              .lte('lease_end', iso(ninety).slice(0, 10)),
          ]);
          const byStatus: Record<string, number> = {};
          for (const l of (listings.data ?? []) as Row[]) {
            const s = String(l.status);
            byStatus[s] = (byStatus[s] ?? 0) + 1;
          }
          summary.disposals_by_status = byStatus;
          summary.viewings_next_7_days = upcoming.count ?? 0;
          summary.viewings_awaiting_feedback = awaiting.count ?? 0;
          summary.leases_ending_within_90_days = leases.count ?? 0;
        } else {
          const { data: surveys } = await supabase
            .from('proposals')
            .select('status')
            .eq('account_id', ws.id)
            .eq('kind', 'survey_report')
            .limit(5000);
          const byStatus: Record<string, number> = {};
          for (const s of (surveys ?? []) as Row[]) {
            const key = String(s.status);
            byStatus[key] = (byStatus[key] ?? 0) + 1;
          }
          summary.surveys_by_status = byStatus;
        }
        result[ws.id] = summary;
      }
      return toolJson({ workspaces: result });
    },
  );

  // ---- Building surveyor ----------------------------------------------

  const surveyor = async (requested?: string) =>
    scopeWorkspaces(await workspaces(), SURVEYOR_SPACE, requested);

  const SURVEY_SELECT =
    'id, account_id, title, status, survey_type, survey_level, survey_property_address, survey_property_postcode, survey_inspection_date, survey_report_reference, survey_terms_received_date, survey_drone_used, client_id, deal_id, recipient_name, recipient_email, total_pence, sent_at, created_at, updated_at';

  server.registerTool(
    'list_surveys',
    {
      description:
        'Survey reports in a building-surveyor workspace: property address, survey type and level, inspection date, report reference, client, status and fee. Filter by status, search (title/address/postcode/reference) or inspection date range.',
      inputSchema: listSurveysSchema,
    },
    async (input) => {
      const scope = await surveyor(input.account_id);
      let query = supabase
        .from('proposals')
        .select(SURVEY_SELECT)
        .in(
          'account_id',
          scope.map((w) => w.id),
        )
        .eq('kind', 'survey_report')
        .order('updated_at', { ascending: false })
        .limit(input.limit);
      if (input.status) query = query.eq('status', input.status);
      if (input.inspected_from) {
        query = query.gte('survey_inspection_date', input.inspected_from);
      }
      if (input.inspected_to) {
        query = query.lte('survey_inspection_date', input.inspected_to);
      }
      const search = input.search ? safeSearch(input.search) : '';
      if (search) {
        const p = `%${search}%`;
        query = query.or(
          `title.ilike.${p},survey_property_address.ilike.${p},survey_property_postcode.ilike.${p},survey_report_reference.ilike.${p}`,
        );
      }
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list surveys');
      const rows = (data ?? []) as Row[];
      const clients = await namesFor(
        supabase,
        'clients',
        rows.map((r) => r.client_id as string),
      );
      return toolJson({
        count: rows.length,
        surveys: rows.map((r) => ({
          id: r.id,
          account_id: r.account_id,
          title: r.title,
          status: r.status,
          survey_type: r.survey_type,
          level: r.survey_level,
          address: r.survey_property_address,
          postcode: r.survey_property_postcode,
          inspection_date: r.survey_inspection_date,
          report_reference: r.survey_report_reference,
          terms_received: r.survey_terms_received_date,
          drone_used: r.survey_drone_used,
          client: clients.get(r.client_id as string) ?? null,
          client_id: r.client_id,
          wip_deal_id: r.deal_id,
          fee_gbp: pounds(r.total_pence as number | null),
          sent_at: r.sent_at,
          updated_at: r.updated_at,
        })),
      });
    },
  );

  server.registerTool(
    'get_survey',
    {
      description:
        'One survey report: property and inspection details, flood risk, EPC, accommodation and services, and the observations written so far (section, condition rating, RICS code, text).',
      inputSchema: getSurveySchema,
    },
    async (input) => {
      const scope = await surveyor();
      const ids = scope.map((w) => w.id);
      const { data, error } = await supabase
        .from('proposals')
        .select(
          `${SURVEY_SELECT}, survey_uprn, survey_flood_risk_band, survey_flood_risk_summary, survey_accommodation, survey_services`,
        )
        .eq('id', input.id)
        .eq('kind', 'survey_report')
        .in('account_id', ids)
        .maybeSingle();
      assertSupabaseOk(data, error, 'get survey');
      if (!data) throw new Error('Survey not found');
      const [observations, epc] = await Promise.all([
        supabase
          .from('survey_observations')
          .select(
            'id, section_key, body, condition_rating, rics_code, sort_order',
          )
          .eq('proposal_id', input.id)
          .order('sort_order', { ascending: true })
          .limit(500),
        supabase
          .from('survey_epc')
          .select(
            'certificate_number, current_rating, potential_rating, lodgement_date, floor_area, fuel_type, recommendations_summary',
          )
          .eq('proposal_id', input.id)
          .maybeSingle(),
      ]);
      return toolJson({
        survey: data,
        epc: epc.data ?? null,
        observations: observations.data ?? [],
      });
    },
  );
};
