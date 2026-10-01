/**
 * Configurable disposals export: the at-a-glance availability sheet the
 * admin team prints, plus every column of the full schedule as optional extras.
 * Pure and client-safe so the dialog can list the columns and render a print
 * view; the server builds the table and the Excel / CSV / PDF files from it.
 */
import { z } from 'zod';

import type {
  XlsxCell,
  XlsxColumnFormat,
  XlsxSheet,
} from '~/lib/spreadsheet/xlsx-workbook';

import {
  ASKING_PRICE_QUALIFIER_PREFIXES,
  DISPOSAL_TYPE_LABELS,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
} from './commercial-constants';
import {
  type ChangeBaseline,
  type ChangeSet,
  type Snapshot,
  type TrackedRow,
  describeFieldChanges,
  diffSnapshots,
  hasChanges,
  summariseChanges,
} from './disposals-export-changes';
import {
  type ColumnDef,
  type DisposalsScheduleInput,
  type ListingContext,
  buildDisposalColumns,
  groupBy as groupRows,
  num,
  str,
} from './disposals-schedule';

type Row = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* Options                                                                    */
/* -------------------------------------------------------------------------- */

export const EXPORT_GROUP_BY = [
  'none',
  'availability',
  'town',
  'office',
] as const;
export type ExportGroupBy = (typeof EXPORT_GROUP_BY)[number];

export const EXPORT_GROUP_BY_LABELS: Record<ExportGroupBy, string> = {
  none: 'No grouping',
  availability: 'Availability',
  town: 'Town',
  office: 'Office',
};

export const EXPORT_SORT_BY = ['town', 'address', 'size', 'updated'] as const;
export type ExportSortBy = (typeof EXPORT_SORT_BY)[number];

export const EXPORT_SORT_BY_LABELS: Record<ExportSortBy, string> = {
  town: 'Town, then address',
  address: 'Address',
  size: 'Size (smallest first)',
  updated: 'Last updated (newest first)',
};

export const EXPORT_FORMATS = ['xlsx', 'csv', 'pdf', 'json'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Office id meaning "disposals with no office assigned". */
export const EXPORT_NO_OFFICE = 'none';

/** Statuses a disposal is "available" in, used as the default filter. */
export const DEFAULT_EXPORT_STATUSES = ['marketing', 'under_offer'] as const;

export const DEFAULT_EXPORT_COLUMNS = [
  'Availability',
  'Address',
  'Town',
  'Size',
  'Rent or price',
] as const;

export const DisposalsExportOptionsSchema = z.object({
  columns: z.array(z.string().min(1).max(80)).min(1).max(100),
  statuses: z.array(z.enum(LISTING_STATUSES)).min(1),
  /** Office ids (or "none"). Empty means every office. */
  officeIds: z.array(z.string().min(1).max(40)).max(200),
  groupBy: z.enum(EXPORT_GROUP_BY),
  sortBy: z.enum(EXPORT_SORT_BY),
  /** Mark what is new or changed since the last export of the same offices and statuses. */
  compareToLast: z.boolean().default(false),
});

export type DisposalsExportOptions = z.infer<
  typeof DisposalsExportOptionsSchema
>;

export const DEFAULT_EXPORT_OPTIONS: DisposalsExportOptions = {
  columns: [...DEFAULT_EXPORT_COLUMNS],
  statuses: [...DEFAULT_EXPORT_STATUSES],
  officeIds: [],
  groupBy: 'availability',
  sortBy: 'town',
  compareToLast: false,
};

/* -------------------------------------------------------------------------- */
/* Derived values                                                             */
/* -------------------------------------------------------------------------- */

const AVAILABILITY_ORDER = [
  'To let',
  'For sale',
  'To let & for sale',
  'Investment',
  'Under offer',
  'Instructed',
  'Draft',
  'Let',
  'Sold',
  'Withdrawn',
];

/** What the team calls it: To let, For sale, Under offer … */
export function availabilityLabel(row: Row): string {
  switch (str(row.status)) {
    case 'under_offer':
      return 'Under offer';
    case 'let':
      return 'Let';
    case 'sold':
      return 'Sold';
    case 'withdrawn':
      return 'Withdrawn';
    case 'draft':
      return 'Draft';
    case 'instructed':
      return 'Instructed';
    default: {
      const type = str(row.disposal_type);
      return (
        (type &&
          (DISPOSAL_TYPE_LABELS as Record<string, string | undefined>)[type]) ||
        'On the market'
      );
    }
  }
}

function availabilityRank(label: string): number {
  const index = AVAILABILITY_ORDER.indexOf(label);
  return index === -1 ? AVAILABILITY_ORDER.length : index;
}

export function addressText(row: Row): string {
  const address = [str(row.address_line_1), str(row.address_line_2)]
    .filter(Boolean)
    .join(', ');
  return address || str(row.name) || '';
}

const number0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const number2 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Listing size, else the combined size of its units. */
function sizeRange(c: ListingContext): { min: number; max: number } | null {
  const min = num(c.row.size_min_sqft);
  const max = num(c.row.size_max_sqft);
  if (min !== null || max !== null) {
    const low = min ?? max!;
    const high = max ?? min!;
    return { min: Math.min(low, high), max: Math.max(low, high) };
  }
  const total = (c.units ?? []).reduce(
    (sum, unit) => sum + (num(unit.size_sqft) ?? 0),
    0,
  );
  return total > 0 ? { min: total, max: total } : null;
}

export function sizeText(c: ListingContext): string {
  const range = sizeRange(c);
  if (!range) return '';
  return range.min === range.max
    ? `${number0.format(range.min)} sq ft`
    : `${number0.format(range.min)} - ${number0.format(range.max)} sq ft`;
}

function rentFrequencySuffix(value: unknown): string {
  const freq = str(value)?.toLowerCase();
  if (!freq || freq === 'pa' || freq === 'per_annum') return 'pa';
  if (freq === 'pcm' || freq === 'per_month') return 'pcm';
  if (freq === 'per_sqft') return 'per sq ft';
  return freq.replace(/[_-]+/g, ' ');
}

/** The rent and/or the price, as a person would write it on a board. */
export function rentOrPriceText(row: Row): string {
  const rent = num(row.asking_rent_pence);
  const rentTo = num(row.asking_rent_to_pence);
  const price = num(row.asking_price_pence);

  const parts: string[] = [];
  if (rent !== null || rentTo !== null) {
    const from = rent !== null ? money.format(rent / 100) : null;
    const to = rentTo !== null ? money.format(rentTo / 100) : null;
    const range = from && to && from !== to ? `${from} - ${to}` : (from ?? to);
    parts.push(`${range} ${rentFrequencySuffix(row.rent_frequency)}`);
  }
  if (price !== null) {
    const qualifier = str(row.asking_price_qualifier);
    const prefix = qualifier
      ? (ASKING_PRICE_QUALIFIER_PREFIXES as Record<string, string | null>)[
          qualifier
        ]
      : null;
    parts.push(`${prefix ? `${prefix} ` : ''}${money.format(price / 100)}`);
  }

  if (parts.length === 0) return 'POA';
  if (parts.length === 2) {
    return `Rent ${parts[0]}\nPrice ${parts[1]}`;
  }
  return parts[0]!;
}

/* -------------------------------------------------------------------------- */
/* Column catalogue                                                           */
/* -------------------------------------------------------------------------- */

export type ExportColumn = ColumnDef<ListingContext> & {
  id: string;
  group: string;
  align?: 'left' | 'right';
};

const GROUP_AT_A_GLANCE = 'At a glance';
const GROUP_BLANK = 'Blank columns';

const GROUP_HEADERS: Record<string, string[]> = {
  'At a glance': ['Town'],
  Identity: [
    'Reference',
    'Project code',
    'Name',
    'Status',
    'Disposal type',
    'Office',
    'Instructed',
    'Instruction',
    'Terms of engagement',
    'Controlled by',
  ],
  Location: [
    'Address line 1',
    'Address line 2',
    'County',
    'Postcode',
    'Country',
    'Latitude',
    'Longitude',
  ],
  'Property and size': [
    'Property type',
    'Use class',
    'Tenure',
    'Size from (sq ft)',
    'Size to (sq ft)',
    'Size accuracy',
    'Size breakdown',
    'Measurement standard',
    'Average floor plate (sq ft)',
    'Land size from',
    'Land size to',
    'Land size unit',
    'Units',
    'Build status',
    'Planning status',
    'Fitted space',
    'Condition',
    'Parking',
    'Parking spaces',
    'EPC band',
    'EPC rating',
    'EPC certificate no.',
    'BREEAM rating',
  ],
  'Pricing and terms': [
    'Asking rent (£)',
    'Asking rent to (£)',
    'Rent frequency',
    'Asking price (£)',
    'Price qualifier',
    'Service charge (£/sq ft)',
    'Rates payable (£/sq ft)',
    'Estate charge (£/sq ft)',
    'Insurance',
    'Let type',
    'Let length (months)',
    'Terms (internal)',
  ],
  Dates: [
    'Available from',
    'Possession',
    'On market',
    'Off market',
    'Created',
    'Last updated',
  ],
  People: [
    'Acting agents',
    'Assigned to',
    'PA',
    'Record owner',
    'Instructing client',
    'Landlord',
    'Other parties',
    'Joint agents',
  ],
  'Marketing and notes': [
    'Summary',
    'Key points',
    'Amenities',
    'Description',
    'Location',
    'Notes',
    'Website URL',
    'External ID',
    'Hide rent from marketing',
    'Hide price from marketing',
    'Hide landlord from marketing',
    'Restricted to assigned agents',
  ],
};

const GROUP_BY_HEADER = new Map<string, string>(
  Object.entries(GROUP_HEADERS).flatMap(([group, headers]) =>
    headers.map((header) => [header, group] as const),
  ),
);

/** Order the picker lists the groups in. */
export const EXPORT_GROUP_ORDER = [
  GROUP_AT_A_GLANCE,
  GROUP_BLANK,
  ...Object.keys(GROUP_HEADERS).filter((group) => group !== GROUP_AT_A_GLANCE),
  'Other',
];

export function buildExportCatalog(
  input: DisposalsScheduleInput,
): ExportColumn[] {
  const composite: ExportColumn[] = [
    {
      id: 'Availability',
      header: 'Availability',
      group: GROUP_AT_A_GLANCE,
      width: 15,
      value: (c) => availabilityLabel(c.row),
    },
    {
      id: 'Address',
      header: 'Address',
      group: GROUP_AT_A_GLANCE,
      width: 34,
      value: (c) => addressText(c.row) || null,
    },
    {
      id: 'Size',
      header: 'Size',
      group: GROUP_AT_A_GLANCE,
      width: 18,
      value: (c) => sizeText(c) || null,
    },
    {
      id: 'Rent or price',
      header: 'Rent or price',
      group: GROUP_AT_A_GLANCE,
      width: 28,
      value: (c) => rentOrPriceText(c.row),
    },
    {
      id: 'Updates',
      header: 'Updates',
      group: GROUP_BLANK,
      width: 32,
      value: () => null,
    },
  ];

  const schedule: ExportColumn[] = buildDisposalColumns(input).map(
    (column) => ({
      ...column,
      id: column.header,
      group: GROUP_BY_HEADER.get(column.header) ?? 'Other',
    }),
  );

  return [...composite, ...schedule].map((column) => ({
    ...column,
    align:
      column.format === 'number' || column.format === 'money'
        ? 'right'
        : 'left',
  }));
}

export type ExportColumnMeta = {
  id: string;
  label: string;
  group: string;
  defaultSelected: boolean;
};

const EMPTY_INPUT: DisposalsScheduleInput = {
  listings: [],
  units: [],
  agents: [],
  coAgents: [],
  parties: [],
  memberNames: new Map(),
  branchNames: new Map(),
  clientNames: new Map(),
};

/** Everything the dialog needs to list the columns; no data required. */
export const EXPORT_COLUMN_META: ExportColumnMeta[] = buildExportCatalog(
  EMPTY_INPUT,
).map((column) => ({
  id: column.id,
  label: column.header,
  group: column.group,
  defaultSelected: (DEFAULT_EXPORT_COLUMNS as readonly string[]).includes(
    column.id,
  ),
}));

const KNOWN_COLUMN_IDS = new Set(EXPORT_COLUMN_META.map((column) => column.id));

export function unknownExportColumns(ids: string[]): string[] {
  return ids.filter((id) => !KNOWN_COLUMN_IDS.has(id));
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

export type ExportTable = {
  title: string;
  generatedAt: string;
  /** Human-readable filters, printed under the title. */
  filters: string[];
  columns: Array<{
    id: string;
    label: string;
    format?: XlsxColumnFormat;
    width: number;
    align: 'left' | 'right';
  }>;
  groups: Array<{
    label: string | null;
    rows: XlsxCell[][];
    /** Parallel to rows; set when comparing with a previous export. */
    tones?: RowTone[];
  }>;
  rowCount: number;
  /** Set when comparing with a previous export that exists. */
  changeSummary: string | null;
  hasChanges: boolean;
};

export type RowTone = 'new' | 'changed' | 'removed' | null;

/** The same table with every cell already turned into display text. */
export type ExportTextTable = Omit<ExportTable, 'groups'> & {
  groups: Array<{ label: string | null; rows: string[][]; tones?: RowTone[] }>;
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function dateText(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : value;
}

export function cellText(value: XlsxCell, format?: XlsxColumnFormat): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return format === 'money' ? money.format(value) : number2.format(value);
  }
  return format === 'date' || format === 'datetime' ? dateText(value) : value;
}

export function toTextTable(table: ExportTable): ExportTextTable {
  return {
    ...table,
    groups: table.groups.map((group) => ({
      label: group.label,
      tones: group.tones,
      rows: group.rows.map((row) =>
        row.map((cell, index) => cellText(cell, table.columns[index]?.format)),
      ),
    })),
  };
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en-GB', { sensitivity: 'base', numeric: true });
}

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function groupKey(
  groupBy: ExportGroupBy,
  c: ListingContext,
  input: DisposalsScheduleInput,
): string | null {
  switch (groupBy) {
    case 'availability':
      return availabilityLabel(c.row);
    case 'town':
      return str(c.row.town) ?? 'No town';
    case 'office': {
      const id = str(c.row.account_branch_id);
      return (id && input.branchNames.get(id)) || 'No office';
    }
    default:
      return null;
  }
}

function compareGroups(
  groupBy: ExportGroupBy,
  a: string | null,
  b: string | null,
): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (groupBy === 'availability') {
    return availabilityRank(a) - availabilityRank(b);
  }
  // "No town" / "No office" go last.
  const aNone = a.startsWith('No ');
  const bNone = b.startsWith('No ');
  if (aNone !== bNone) return aNone ? 1 : -1;
  return compareText(a, b);
}

function compareWithin(sortBy: ExportSortBy) {
  return (a: ListingContext, b: ListingContext): number => {
    const byAddress = () => compareText(addressText(a.row), addressText(b.row));
    switch (sortBy) {
      case 'address':
        return byAddress();
      case 'size':
        return (
          compareNullableNumber(
            sizeRange(a)?.min ?? null,
            sizeRange(b)?.min ?? null,
          ) || byAddress()
        );
      case 'updated':
        return (
          compareText(
            String(b.row.updated_at ?? ''),
            String(a.row.updated_at ?? ''),
          ) || byAddress()
        );
      default:
        return (
          compareText(
            str(a.row.town) ?? '\uffff',
            str(b.row.town) ?? '\uffff',
          ) || byAddress()
        );
    }
  };
}

export function listingMatchesExport(
  row: Row,
  options: Pick<DisposalsExportOptions, 'statuses' | 'officeIds'>,
): boolean {
  if (!(options.statuses as string[]).includes(String(row.status))) {
    return false;
  }
  if (options.officeIds.length === 0) return true;
  const office = str(row.account_branch_id) ?? EXPORT_NO_OFFICE;
  return options.officeIds.includes(office);
}

function describeFilters(
  options: DisposalsExportOptions,
  input: DisposalsScheduleInput,
): string[] {
  const offices =
    options.officeIds.length === 0
      ? 'All offices'
      : options.officeIds
          .map((id) =>
            id === EXPORT_NO_OFFICE
              ? 'No office'
              : (input.branchNames.get(id) ?? 'Unknown office'),
          )
          .sort(compareText)
          .join(', ');
  const statuses = LISTING_STATUSES.filter((status) =>
    (options.statuses as string[]).includes(status),
  )
    .map((status) => LISTING_STATUS_LABELS[status])
    .join(', ');
  return [`Offices: ${offices}`, `Status: ${statuses}`];
}

function selectContexts(
  input: DisposalsScheduleInput,
  options: Pick<DisposalsExportOptions, 'statuses' | 'officeIds'>,
): ListingContext[] {
  const agentsByListing = groupRows(input.agents, 'listing_id');
  const partiesByListing = groupRows(input.parties, 'listing_id');
  const coAgentsByListing = groupRows(input.coAgents, 'listing_id');
  const unitsByListing = groupRows(input.units, 'listing_id');

  return input.listings
    .filter((row) => listingMatchesExport(row, options))
    .map((row) => {
      const id = String(row.id);
      const units = unitsByListing.get(id) ?? [];
      return {
        row,
        agents: agentsByListing.get(id) ?? [],
        parties: partiesByListing.get(id) ?? [],
        coAgents: coAgentsByListing.get(id) ?? [],
        unitCount: units.length,
        units,
      };
    });
}

function trackedRowFor(c: ListingContext): TrackedRow {
  return {
    availability: availabilityLabel(c.row),
    address: addressText(c.row),
    town: str(c.row.town) ?? '',
    size: sizeText(c),
    price: rentOrPriceText(c.row),
  };
}

/** What the change report remembers, for the disposals this export covers. */
export function buildExportSnapshot(
  input: DisposalsScheduleInput,
  options: Pick<DisposalsExportOptions, 'statuses' | 'officeIds'>,
): Snapshot {
  return Object.fromEntries(
    selectContexts(input, options).map((context) => [
      String(context.row.id),
      trackedRowFor(context),
    ]),
  );
}

/** Where a disposal that dropped off the list has gone. */
function whereItWent(
  input: DisposalsScheduleInput,
  options: Pick<DisposalsExportOptions, 'statuses' | 'officeIds'>,
  id: string,
): string {
  const row = input.listings.find((listing) => String(listing.id) === id);
  if (!row) return 'Removed';
  if (!(options.statuses as string[]).includes(String(row.status))) {
    return availabilityLabel(row);
  }
  const office = str(row.account_branch_id);
  const name = office ? input.branchNames.get(office) : null;
  return name ? `Moved to ${name}` : 'Moved office';
}

const CHANGE_COLUMN_ID = '__change';

/**
 * `compare` is null for a plain export. With `{ baseline: null }` the export
 * is asked to compare but there is nothing to compare with yet.
 */
export type ExportCompare = { baseline: ChangeBaseline | null } | null;

export function buildDisposalsExportTable(
  input: DisposalsScheduleInput,
  options: DisposalsExportOptions,
  generatedAt: string,
  compare: ExportCompare = null,
): ExportTable {
  const catalog = new Map(
    buildExportCatalog(input).map((column) => [column.id, column]),
  );
  const ids = [...new Set(options.columns)];
  // A change report is unreadable without knowing which disposal changed.
  if (compare && !ids.includes('Address')) ids.unshift('Address');
  const columns = ids
    .map((id) => catalog.get(id))
    .filter((column): column is ExportColumn => Boolean(column));

  const contexts = selectContexts(input, options);

  let changes: ChangeSet | null = null;
  if (compare?.baseline) {
    changes = diffSnapshots(
      compare.baseline,
      buildExportSnapshot(input, options),
      (id) => whereItWent(input, options, id),
    );
  }

  const changeCell = (context: ListingContext): XlsxCell => {
    if (!changes) return null;
    const id = String(context.row.id);
    if (changes.newIds.has(id)) return 'New';
    const changed = changes.changedById.get(id);
    return changed ? describeFieldChanges(changed) : null;
  };
  const toneFor = (context: ListingContext): RowTone => {
    if (!changes) return null;
    const id = String(context.row.id);
    if (changes.newIds.has(id)) return 'new';
    return changes.changedById.has(id) ? 'changed' : null;
  };

  const within = compareWithin(options.sortBy);
  const buckets = new Map<string | null, ListingContext[]>();
  for (const context of contexts) {
    const key = groupKey(options.groupBy, context, input);
    const list = buckets.get(key) ?? [];
    list.push(context);
    buckets.set(key, list);
  }

  const groups: ExportTable['groups'] = [...buckets.entries()]
    .sort(([a], [b]) => compareGroups(options.groupBy, a, b))
    .map(([label, items]) => {
      const sorted = items.sort(within);
      return {
        label,
        rows: sorted.map((item) => [
          ...(compare ? [changeCell(item)] : []),
          ...columns.map((column) => column.value(item)),
        ]),
        ...(compare ? { tones: sorted.map(toneFor) } : {}),
      };
    });

  if (changes && changes.removed.length > 0) {
    const removedRows = changes.removed.map((entry) => {
      const byColumn: Record<string, string> = {
        Availability: entry.now,
        Address: entry.previous.address,
        Town: entry.previous.town,
        Size: entry.previous.size,
        'Rent or price': entry.previous.price,
      };
      return [
        'Left the list',
        ...columns.map((column) => byColumn[column.id] || null),
      ] as XlsxCell[];
    });
    groups.push({
      label: 'No longer on this list',
      rows: removedRows,
      tones: removedRows.map(() => 'removed' as const),
    });
  }

  const filters = describeFilters(options, input);
  if (compare) {
    filters.push(
      changes
        ? `Changes since ${dateText(changes.since)}: ${summariseChanges(changes)}`
        : 'Changes: nothing to compare with yet, changes show from the next export',
    );
  }

  return {
    title: 'Availability schedule',
    generatedAt,
    filters,
    columns: [
      ...(compare
        ? [
            {
              id: CHANGE_COLUMN_ID,
              label: 'Change',
              width: 26,
              align: 'left' as const,
            },
          ]
        : []),
      ...columns.map((column) => ({
        id: column.id,
        label: column.header,
        format: column.format,
        width: column.width ?? 14,
        align: column.align ?? ('left' as const),
      })),
    ],
    groups,
    rowCount: contexts.length,
    changeSummary: changes ? summariseChanges(changes) : null,
    hasChanges: changes ? hasChanges(changes) : false,
  };
}

/** Flat Excel sheet; grouping only decides the order of the rows. */
export function exportTableToSheet(table: ExportTable): XlsxSheet {
  return {
    name: 'Availability',
    columns: table.columns.map((column) => ({
      header: column.label,
      format: column.format,
      width: column.width,
    })),
    rows: table.groups.flatMap((group) => group.rows),
  };
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                        */
/* -------------------------------------------------------------------------- */

function csvCell(value: XlsxCell, format?: XlsxColumnFormat): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (typeof value === 'boolean') text = value ? 'Yes' : 'No';
  else if (typeof value === 'number') return String(value);
  else if (format === 'date') text = value.slice(0, 10);
  else text = value;

  // Stop spreadsheet apps running a cell as a formula.
  if (/^[=+@\t\r]|^-(?!\d)/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 with a BOM so Excel reads £ and accents correctly. */
export function exportTableToCsv(table: ExportTable): string {
  const lines = [
    table.columns.map((column) => csvCell(column.label)).join(','),
    ...table.groups.flatMap((group) =>
      group.rows.map((row) =>
        row
          .map((cell, index) => csvCell(cell, table.columns[index]?.format))
          .join(','),
      ),
    ),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/* -------------------------------------------------------------------------- */
/* Print view                                                                 */
/* -------------------------------------------------------------------------- */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A self-contained, landscape-A4 print page. */
export function renderExportHtml(table: ExportTextTable): string {
  const totalWidth =
    table.columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const cols = table.columns
    .map(
      (column) =>
        `<col style="width:${((column.width / totalWidth) * 100).toFixed(2)}%">`,
    )
    .join('');
  const head = table.columns
    .map(
      (column) =>
        `<th class="${column.align}">${escapeHtml(column.label)}</th>`,
    )
    .join('');

  const body = table.groups
    .map((group) => {
      const heading =
        group.label === null
          ? ''
          : `<tr class="group"><td colspan="${table.columns.length}">${escapeHtml(group.label)} <span>${group.rows.length}</span></td></tr>`;
      const rows = group.rows
        .map(
          (row, rowIndex) =>
            `<tr${group.tones?.[rowIndex] ? ` class="tone-${group.tones[rowIndex]}"` : ''}>${row
              .map(
                (cell, index) =>
                  `<td class="${table.columns[index]?.align ?? 'left'}">${escapeHtml(cell)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('');
      return heading + rows;
    })
    .join('');

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${escapeHtml(table.title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 11px/1.35 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; }
  h1 { margin: 0 0 2px; font-size: 16px; }
  .meta { margin: 0 0 8px; color: #555; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  th { background: #1f2937; color: #fff; font-weight: 600; padding: 4px 6px; text-align: left; }
  td { padding: 4px 6px; border-bottom: 1px solid #ddd; vertical-align: top; white-space: pre-line; overflow-wrap: anywhere; }
  tr { break-inside: avoid; }
  tbody tr:not(.group):nth-child(even) td { background: #f7f7f8; }
  .right { text-align: right; }
  tbody tr.tone-new td { background: #dcfce7 !important; }
  tbody tr.tone-changed td { background: #fef3c7 !important; }
  tbody tr.tone-removed td { background: #f3f4f6 !important; color: #6b7280; }
  .meta strong { color: #111; }
  .group td { background: #e5e7eb; font-weight: 700; padding: 5px 6px; border-bottom: 1px solid #9ca3af; }
  .group td span { font-weight: 400; color: #555; margin-left: 6px; }
  .empty { margin-top: 16px; color: #555; }
</style>
</head>
<body>
<h1>${escapeHtml(table.title)}</h1>
<p class="meta">${escapeHtml(table.filters.join('  |  '))}  |  ${table.rowCount} disposal${table.rowCount === 1 ? '' : 's'}  |  ${escapeHtml(table.generatedAt)}</p>
<table><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body>
</html>`;
}
