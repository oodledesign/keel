import type {
  XlsxCell,
  XlsxColumn,
  XlsxSheet,
} from '~/lib/spreadsheet/xlsx-workbook';

import {
  ASKING_PRICE_QUALIFIER_LABELS,
  BREEAM_RATING_LABELS,
  DISPOSAL_TYPE_LABELS,
  LISTING_CONTROLLED_BY_LABELS,
  LISTING_LET_TYPE_LABELS,
  LISTING_PARTY_ROLE_LABELS,
  LISTING_SIZE_ACCURACY_LABELS,
  LISTING_SIZE_BREAKDOWN_LABELS,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  TERMS_OF_ENGAGEMENT_LABELS,
  formatCommercialUseClassLabel,
} from './commercial-constants';

type Row = Record<string, unknown>;

export type DisposalsScheduleInput = {
  listings: Row[];
  units: Row[];
  agents: Row[];
  coAgents: Row[];
  parties: Row[];
  memberNames: Map<string, string>;
  branchNames: Map<string, string>;
  clientNames: Map<string, string>;
};

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

function pounds(pence: unknown): number | null {
  const n = num(pence);
  return n === null ? null : n / 100;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function label<T extends string>(
  labels: Record<T, string>,
  value: unknown,
): string | null {
  const key = str(value);
  if (!key) return null;
  return (labels as Record<string, string>)[key] ?? humanize(key);
}

/** "to_let_and_for_sale" → "To let and for sale". */
export function humanize(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  const spaced = text.replace(/[_-]+/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function stringList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return items.length ? items.join('\n') : null;
}

function joinLines(values: Array<string | null>): string | null {
  const items = values.filter((value): value is string => Boolean(value));
  return items.length ? items.join('\n') : null;
}

function relation(value: unknown): Row | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? (row as Row) : null;
}

export function clientDisplayName(row: Row | null): string | null {
  if (!row) return null;
  return (
    str(row.company_name) ??
    str(row.display_name) ??
    joinName(row.first_name, row.last_name)
  );
}

function joinName(first: unknown, last: unknown): string | null {
  return str([str(first), str(last)].filter(Boolean).join(' '));
}

function contactLine(row: Row): string | null {
  const contact = relation(row.contacts);
  const name =
    str(row.contact_name) ??
    str(contact?.full_name) ??
    joinName(contact?.first_name, contact?.last_name);
  const email = str(row.contact_email) ?? str(contact?.email);
  const phone = str(row.contact_phone) ?? str(contact?.phone);
  return str([name, email, phone].filter(Boolean).join(', '));
}

function partyLine(row: Row, withRole: boolean): string | null {
  const company = clientDisplayName(relation(row.clients));
  const contact = contactLine(row);
  const who =
    company && contact ? `${company} (${contact})` : (company ?? contact);
  if (!who) return null;
  if (!withRole) return who;
  const role = label(LISTING_PARTY_ROLE_LABELS, row.role) ?? 'Other';
  return `${role}: ${who}`;
}

function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const row of rows) {
    const id = str(row[key]);
    if (!id) continue;
    const list = out.get(id) ?? [];
    list.push(row);
    out.set(id, list);
  }
  for (const list of out.values()) {
    list.sort((a, b) => (num(a.sort_order) ?? 0) - (num(b.sort_order) ?? 0));
  }
  return out;
}

const STATUS_ORDER = new Map<string, number>(
  LISTING_STATUSES.map((status, index) => [status, index]),
);

function compareListings(a: Row, b: Row): number {
  const statusDiff =
    (STATUS_ORDER.get(String(a.status)) ?? 99) -
    (STATUS_ORDER.get(String(b.status)) ?? 99);
  if (statusDiff !== 0) return statusDiff;
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'en-GB', {
    sensitivity: 'base',
  });
}

type ColumnDef<T> = XlsxColumn & { value: (row: T) => XlsxCell };

type ListingContext = {
  row: Row;
  agents: Row[];
  parties: Row[];
  coAgents: Row[];
  unitCount: number;
};

function buildDisposalColumns(
  input: DisposalsScheduleInput,
): ColumnDef<ListingContext>[] {
  const member = (id: unknown) => {
    const key = str(id);
    return key ? (input.memberNames.get(key) ?? null) : null;
  };

  return [
    {
      header: 'Reference',
      value: (c) => str(c.row.reference_number),
      width: 14,
    },
    {
      header: 'Project code',
      value: (c) => str(c.row.project_code),
      width: 14,
    },
    { header: 'Name', value: (c) => str(c.row.name), width: 32 },
    {
      header: 'Status',
      value: (c) => label(LISTING_STATUS_LABELS, c.row.status),
    },
    {
      header: 'Disposal type',
      value: (c) => label(DISPOSAL_TYPE_LABELS, c.row.disposal_type),
      width: 16,
    },
    { header: 'Instructed', value: (c) => bool(c.row.is_instructed) },
    { header: 'Instruction', value: (c) => humanize(c.row.instruction_nature) },
    {
      header: 'Terms of engagement',
      value: (c) =>
        label(TERMS_OF_ENGAGEMENT_LABELS, c.row.terms_of_engagement),
    },
    {
      header: 'Office',
      value: (c) => {
        const id = str(c.row.account_branch_id);
        return id ? (input.branchNames.get(id) ?? null) : null;
      },
      width: 16,
    },
    {
      header: 'Acting agents',
      value: (c) =>
        str(
          c.agents
            .map((agent) => member(agent.user_id))
            .filter(Boolean)
            .join(', '),
        ),
      width: 24,
    },
    {
      header: 'Assigned to',
      value: (c) => member(c.row.assigned_to),
      width: 18,
    },
    { header: 'PA', value: (c) => member(c.row.pa_user_id), width: 18 },
    {
      header: 'Record owner',
      value: (c) => member(c.row.record_owner_user_id),
      width: 18,
    },
    {
      header: 'Instructing client',
      value: (c) => {
        const id = str(c.row.instructing_client_id);
        return id ? (input.clientNames.get(id) ?? null) : null;
      },
      width: 24,
    },
    {
      header: 'Landlord',
      value: (c) =>
        joinLines(
          c.parties
            .filter((party) => party.role === 'landlord')
            .map((party) => partyLine(party, false)),
        ),
      width: 32,
    },
    {
      header: 'Other parties',
      value: (c) =>
        joinLines(
          c.parties
            .filter((party) => party.role !== 'landlord')
            .map((party) => partyLine(party, true)),
        ),
      width: 32,
    },
    {
      header: 'Joint agents',
      value: (c) =>
        joinLines(c.coAgents.map((agent) => partyLine(agent, false))),
      width: 32,
    },
    {
      header: 'Address line 1',
      value: (c) => str(c.row.address_line_1),
      width: 24,
    },
    {
      header: 'Address line 2',
      value: (c) => str(c.row.address_line_2),
      width: 20,
    },
    { header: 'Town', value: (c) => str(c.row.town), width: 16 },
    { header: 'County', value: (c) => str(c.row.county), width: 16 },
    { header: 'Postcode', value: (c) => str(c.row.postcode), width: 11 },
    { header: 'Country', value: (c) => str(c.row.country) },
    { header: 'Latitude', format: 'number', value: (c) => num(c.row.latitude) },
    {
      header: 'Longitude',
      format: 'number',
      value: (c) => num(c.row.longitude),
    },
    { header: 'Property type', value: (c) => str(c.row.sector), width: 18 },
    {
      header: 'Use class',
      value: (c) => formatCommercialUseClassLabel(str(c.row.use_class)),
      width: 24,
    },
    { header: 'Tenure', value: (c) => humanize(c.row.tenure) },
    {
      header: 'Size from (sq ft)',
      format: 'number',
      value: (c) => num(c.row.size_min_sqft),
    },
    {
      header: 'Size to (sq ft)',
      format: 'number',
      value: (c) => num(c.row.size_max_sqft),
    },
    {
      header: 'Size accuracy',
      value: (c) => label(LISTING_SIZE_ACCURACY_LABELS, c.row.size_accuracy),
    },
    {
      header: 'Size breakdown',
      value: (c) => label(LISTING_SIZE_BREAKDOWN_LABELS, c.row.size_breakdown),
    },
    {
      header: 'Measurement standard',
      value: (c) => humanize(c.row.measurement_standard),
    },
    {
      header: 'Average floor plate (sq ft)',
      format: 'number',
      value: (c) => num(c.row.average_floor_plate_sqft),
    },
    {
      header: 'Land size from',
      format: 'number',
      value: (c) => num(c.row.land_size_min),
    },
    {
      header: 'Land size to',
      format: 'number',
      value: (c) => num(c.row.land_size_max),
    },
    {
      header: 'Land size unit',
      value: (c) => humanize(c.row.land_size_metric),
    },
    { header: 'Units', format: 'number', value: (c) => c.unitCount || null },
    {
      header: 'Asking rent (£)',
      format: 'money',
      value: (c) => pounds(c.row.asking_rent_pence),
    },
    {
      header: 'Asking rent to (£)',
      format: 'money',
      value: (c) => pounds(c.row.asking_rent_to_pence),
    },
    { header: 'Rent frequency', value: (c) => humanize(c.row.rent_frequency) },
    {
      header: 'Asking price (£)',
      format: 'money',
      value: (c) => pounds(c.row.asking_price_pence),
    },
    {
      header: 'Price qualifier',
      value: (c) =>
        c.row.asking_price_pence == null
          ? null
          : label(ASKING_PRICE_QUALIFIER_LABELS, c.row.asking_price_qualifier),
    },
    {
      header: 'Service charge (£/sq ft)',
      format: 'money',
      value: (c) => num(c.row.service_charge_per_sqft),
    },
    {
      header: 'Rates payable (£/sq ft)',
      format: 'money',
      value: (c) => num(c.row.rates_payable_per_sqft),
    },
    {
      header: 'Estate charge (£/sq ft)',
      format: 'money',
      value: (c) => num(c.row.estate_charge_per_sqft),
    },
    { header: 'Insurance', value: (c) => humanize(c.row.insurance_type) },
    {
      header: 'Let type',
      value: (c) => label(LISTING_LET_TYPE_LABELS, c.row.let_type),
    },
    {
      header: 'Let length (months)',
      format: 'number',
      value: (c) => num(c.row.let_contract_length_months),
    },
    {
      header: 'Available from',
      format: 'date',
      value: (c) => str(c.row.available_from),
    },
    { header: 'Possession', value: (c) => humanize(c.row.possession) },
    { header: 'Build status', value: (c) => humanize(c.row.build_status) },
    {
      header: 'Planning status',
      value: (c) => humanize(c.row.planning_status),
    },
    { header: 'Fitted space', value: (c) => bool(c.row.fitted_space) },
    {
      header: 'Condition',
      value: (c) => str(c.row.condition_description),
      width: 24,
    },
    { header: 'EPC band', value: (c) => str(c.row.epc_band) },
    {
      header: 'EPC rating',
      format: 'number',
      value: (c) => num(c.row.epc_rating),
    },
    {
      header: 'EPC certificate no.',
      value: (c) => str(c.row.epc_certificate_number),
      width: 22,
    },
    {
      header: 'BREEAM rating',
      value: (c) => label(BREEAM_RATING_LABELS, c.row.breeam_rating),
    },
    { header: 'Parking', value: (c) => bool(c.row.parking_available) },
    {
      header: 'Parking spaces',
      format: 'number',
      value: (c) => num(c.row.parking_spaces),
    },
    {
      header: 'Controlled by',
      value: (c) => label(LISTING_CONTROLLED_BY_LABELS, c.row.controlled_by),
    },
    {
      header: 'On market',
      format: 'date',
      value: (c) => str(c.row.on_market_at),
    },
    {
      header: 'Off market',
      format: 'date',
      value: (c) => str(c.row.off_market_at),
    },
    {
      header: 'Hide rent from marketing',
      value: (c) => bool(c.row.hide_rent_from_marketing),
    },
    {
      header: 'Hide price from marketing',
      value: (c) => bool(c.row.hide_price_from_marketing),
    },
    {
      header: 'Hide landlord from marketing',
      value: (c) => bool(c.row.hide_landlord_from_marketing),
    },
    {
      header: 'Restricted to assigned agents',
      value: (c) => bool(c.row.restrict_access_to_assigned),
    },
    { header: 'Summary', value: (c) => str(c.row.summary), width: 40 },
    {
      header: 'Key points',
      value: (c) => stringList(c.row.key_points),
      width: 40,
    },
    {
      header: 'Amenities',
      value: (c) => stringList(c.row.amenities),
      width: 30,
    },
    { header: 'Description', value: (c) => str(c.row.description), width: 50 },
    { header: 'Location', value: (c) => str(c.row.location_copy), width: 40 },
    {
      header: 'Terms (internal)',
      value: (c) => str(c.row.terms_internal),
      width: 40,
    },
    { header: 'Notes', value: (c) => str(c.row.notes), width: 40 },
    { header: 'Website URL', value: (c) => str(c.row.website_url), width: 30 },
    { header: 'External ID', value: (c) => str(c.row.external_id), width: 16 },
    {
      header: 'Created',
      format: 'datetime',
      value: (c) => str(c.row.created_at),
    },
    {
      header: 'Last updated',
      format: 'datetime',
      value: (c) => str(c.row.updated_at),
    },
  ];
}

type UnitContext = { unit: Row; listing: Row | null };

const UNIT_COLUMNS: ColumnDef<UnitContext>[] = [
  {
    header: 'Disposal reference',
    value: (c) => str(c.listing?.reference_number),
    width: 16,
  },
  { header: 'Disposal', value: (c) => str(c.listing?.name), width: 32 },
  {
    header: 'Disposal status',
    value: (c) => label(LISTING_STATUS_LABELS, c.listing?.status),
  },
  { header: 'Unit', value: (c) => str(c.unit.label), width: 20 },
  {
    header: 'Floor / unit',
    value: (c) => str(c.unit.floor_or_unit),
    width: 14,
  },
  { header: 'Status', value: (c) => humanize(c.unit.status) },
  {
    header: 'Size (sq ft)',
    format: 'number',
    value: (c) => num(c.unit.size_sqft),
  },
  {
    header: 'Size accuracy',
    value: (c) => label(LISTING_SIZE_ACCURACY_LABELS, c.unit.size_accuracy),
  },
  {
    header: 'Measurement standard',
    value: (c) => humanize(c.unit.measurement_standard),
  },
  { header: 'Part floor', value: (c) => bool(c.unit.part_floor) },
  {
    header: 'Asking rent (£)',
    format: 'money',
    value: (c) => pounds(c.unit.asking_rent_pence),
  },
  {
    header: 'Rent (£/sq ft)',
    format: 'money',
    value: (c) => num(c.unit.rent_per_sqft),
  },
  {
    header: 'Service charge (£/sq ft)',
    format: 'money',
    value: (c) => num(c.unit.service_charge_per_sqft),
  },
  {
    header: 'Rates payable (£/sq ft)',
    format: 'money',
    value: (c) => num(c.unit.rates_payable_per_sqft),
  },
  {
    header: 'Estate charge (£/sq ft)',
    format: 'money',
    value: (c) => num(c.unit.estate_charge_per_sqft),
  },
  { header: 'Tenure', value: (c) => humanize(c.unit.tenure) },
  { header: 'Property type', value: (c) => str(c.unit.sector), width: 18 },
  { header: 'EPC band', value: (c) => str(c.unit.epc_band) },
  { header: 'Possession', value: (c) => humanize(c.unit.possession) },
  { header: 'Build status', value: (c) => humanize(c.unit.build_status) },
  { header: 'Planning status', value: (c) => humanize(c.unit.planning_status) },
  { header: 'Fitted space', value: (c) => bool(c.unit.fitted_space) },
  { header: 'Description', value: (c) => str(c.unit.description), width: 40 },
  { header: 'Notes', value: (c) => str(c.unit.notes), width: 40 },
  { header: 'External ID', value: (c) => str(c.unit.external_id), width: 16 },
];

function toSheet<T>(
  name: string,
  columns: ColumnDef<T>[],
  items: T[],
): XlsxSheet {
  return {
    name,
    columns: columns.map(({ header, format, width }) => ({
      header,
      format,
      width,
    })),
    rows: items.map((item) => columns.map((column) => column.value(item))),
  };
}

/**
 * Drop disposals restricted to assigned agents unless the user can see all
 * (owner/admin) or is on the disposal (assigned, PA, owner, creator, agent).
 */
export function filterScheduleListingsForUser(params: {
  listings: Row[];
  agents: Row[];
  userId: string;
  canSeeRestricted: boolean;
}): Row[] {
  if (params.canSeeRestricted) return params.listings;

  const agentListingIds = new Set(
    params.agents
      .filter((agent) => agent.user_id === params.userId)
      .map((agent) => String(agent.listing_id)),
  );

  return params.listings.filter(
    (row) =>
      !row.restrict_access_to_assigned ||
      [
        row.assigned_to,
        row.pa_user_id,
        row.record_owner_user_id,
        row.created_by,
      ].includes(params.userId) ||
      agentListingIds.has(String(row.id)),
  );
}

/** Disposals + Units sheets for the full disposals schedule export. */
export function buildDisposalsScheduleSheets(
  input: DisposalsScheduleInput,
): XlsxSheet[] {
  const listings = [...input.listings].sort(compareListings);
  const agentsByListing = groupBy(input.agents, 'listing_id');
  const partiesByListing = groupBy(input.parties, 'listing_id');
  const coAgentsByListing = groupBy(input.coAgents, 'listing_id');
  const unitsByListing = groupBy(input.units, 'listing_id');

  const disposals = listings.map((row) => {
    const id = String(row.id);
    return {
      row,
      agents: agentsByListing.get(id) ?? [],
      parties: partiesByListing.get(id) ?? [],
      coAgents: coAgentsByListing.get(id) ?? [],
      unitCount: unitsByListing.get(id)?.length ?? 0,
    };
  });

  const units = listings.flatMap((listing) =>
    (unitsByListing.get(String(listing.id)) ?? []).map((unit) => ({
      unit,
      listing,
    })),
  );

  return [
    toSheet('Disposals', buildDisposalColumns(input), disposals),
    toSheet('Units', UNIT_COLUMNS, units),
  ];
}
