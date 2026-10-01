import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPORT_OPTIONS,
  type DisposalsExportOptions,
  EXPORT_COLUMN_META,
  availabilityLabel,
  buildDisposalsExportTable,
  exportTableToCsv,
  exportTableToSheet,
  renderExportHtml,
  rentOrPriceText,
  toTextTable,
  unknownExportColumns,
} from './disposals-export';
import { buildExportPdf } from './disposals-export-pdf';
import type { DisposalsScheduleInput } from './disposals-schedule';

const TW = 'office-tw';
const TON = 'office-ton';

function input(): DisposalsScheduleInput {
  return {
    listings: [
      {
        id: 'a',
        name: 'Riverside',
        status: 'marketing',
        disposal_type: 'to_let',
        address_line_1: '4 River Road',
        town: 'Tunbridge Wells',
        account_branch_id: TW,
        size_min_sqft: 1000,
        size_max_sqft: 2500,
        asking_rent_pence: 2500000,
        rent_frequency: 'per_annum',
      },
      {
        id: 'b',
        name: 'High St Shop',
        status: 'marketing',
        disposal_type: 'for_sale',
        address_line_1: '12 High Street',
        town: 'Tonbridge',
        account_branch_id: TON,
        size_min_sqft: 800,
        asking_price_pence: 45000000,
        asking_price_qualifier: 'guide_price',
      },
      {
        id: 'c',
        name: 'Old Mill',
        status: 'under_offer',
        disposal_type: 'to_let',
        address_line_1: '1 Mill Lane',
        town: 'Tunbridge Wells',
        account_branch_id: TW,
        asking_rent_pence: 1200000,
        rent_frequency: 'pcm',
      },
      {
        id: 'd',
        name: 'Gone',
        status: 'let',
        disposal_type: 'to_let',
        address_line_1: '9 Gone Street',
        town: 'Tunbridge Wells',
        account_branch_id: TW,
      },
      {
        id: 'e',
        name: '=HYPERLINK("x")',
        status: 'marketing',
        disposal_type: 'to_let',
        address_line_1: '=SUM(A1)',
        town: 'Unitville',
      },
    ],
    units: [
      { listing_id: 'e', size_sqft: 400 },
      { listing_id: 'e', size_sqft: 600 },
    ],
    agents: [],
    coAgents: [],
    parties: [],
    memberNames: new Map(),
    branchNames: new Map([
      [TW, 'Tunbridge Wells'],
      [TON, 'Tonbridge'],
    ]),
    clientNames: new Map(),
  };
}

function options(over: Partial<DisposalsExportOptions> = {}) {
  return { ...DEFAULT_EXPORT_OPTIONS, ...over };
}

describe('availability and price wording', () => {
  it('uses the team vocabulary', () => {
    expect(
      availabilityLabel({ status: 'marketing', disposal_type: 'to_let' }),
    ).toBe('To let');
    expect(
      availabilityLabel({ status: 'marketing', disposal_type: 'for_sale' }),
    ).toBe('For sale');
    expect(
      availabilityLabel({ status: 'under_offer', disposal_type: 'to_let' }),
    ).toBe('Under offer');
  });

  it('writes rent, price, both, or POA', () => {
    expect(
      rentOrPriceText({
        asking_rent_pence: 2500000,
        rent_frequency: 'per_annum',
      }),
    ).toBe('£25,000 pa');
    expect(
      rentOrPriceText({ asking_rent_pence: 100000, rent_frequency: 'pcm' }),
    ).toBe('£1,000 pcm');
    expect(
      rentOrPriceText({
        asking_price_pence: 45000000,
        asking_price_qualifier: 'guide_price',
      }),
    ).toBe('Guide Price £450,000');
    expect(
      rentOrPriceText({
        asking_rent_pence: 100000,
        asking_price_pence: 20000000,
      }),
    ).toBe('Rent £1,000 pa\nPrice £200,000');
    expect(rentOrPriceText({})).toBe('POA');
  });
});

describe('buildDisposalsExportTable', () => {
  it('defaults to the at-a-glance columns for live disposals, grouped by availability', () => {
    const table = buildDisposalsExportTable(input(), options(), 'now');
    expect(table.columns.map((c) => c.label)).toEqual([
      'Availability',
      'Address',
      'Town',
      'Size',
      'Rent or price',
    ]);
    // "Let" (completed) is excluded by the default status filter.
    expect(table.rowCount).toBe(4);
    expect(table.groups.map((g) => g.label)).toEqual([
      'To let',
      'For sale',
      'Under offer',
    ]);
    const toLet = table.groups[0]!.rows;
    // Sorted by town within the group.
    expect(toLet.map((r) => r[1])).toEqual(['4 River Road', '=SUM(A1)']);
  });

  it('can show Tunbridge Wells without Tonbridge', () => {
    const table = buildDisposalsExportTable(
      input(),
      options({ officeIds: [TW], groupBy: 'none' }),
      'now',
    );
    const towns = table.groups.flatMap((g) => g.rows.map((r) => r[2]));
    expect(towns).not.toContain('Tonbridge');
    expect(table.rowCount).toBe(2);
    expect(table.filters[0]).toBe('Offices: Tunbridge Wells');
  });

  it('can pick disposals with no office', () => {
    const table = buildDisposalsExportTable(
      input(),
      options({ officeIds: ['none'], groupBy: 'none' }),
      'now',
    );
    expect(table.rowCount).toBe(1);
  });

  it('formats size, falling back to the units total', () => {
    const table = buildDisposalsExportTable(
      input(),
      options({ groupBy: 'none', sortBy: 'address' }),
      'now',
    );
    const sizes = Object.fromEntries(
      table.groups.flatMap((g) => g.rows).map((r) => [r[1], r[3]]),
    );
    expect(sizes['4 River Road']).toBe('1,000 - 2,500 sq ft');
    expect(sizes['12 High Street']).toBe('800 sq ft');
    expect(sizes['=SUM(A1)']).toBe('1,000 sq ft');
    expect(sizes['1 Mill Lane']).toBeNull();
  });

  it('adds extra columns from the full schedule and a blank updates column', () => {
    const table = buildDisposalsExportTable(
      input(),
      options({ columns: ['Address', 'Postcode', 'Updates'], groupBy: 'none' }),
      'now',
    );
    expect(table.columns.map((c) => c.label)).toEqual([
      'Address',
      'Postcode',
      'Updates',
    ]);
    expect(table.groups[0]!.rows[0]![2]).toBeNull();
  });

  it('knows every column id it offers', () => {
    expect(unknownExportColumns(['Address', 'Nope'])).toEqual(['Nope']);
    expect(
      EXPORT_COLUMN_META.filter((c) => c.defaultSelected).map((c) => c.id),
    ).toEqual(
      expect.arrayContaining([
        'Availability',
        'Address',
        'Town',
        'Size',
        'Rent or price',
      ]),
    );
    expect(new Set(EXPORT_COLUMN_META.map((c) => c.id)).size).toBe(
      EXPORT_COLUMN_META.length,
    );
  });
});

describe('renderers', () => {
  const table = buildDisposalsExportTable(
    input(),
    options(),
    '1 Oct 2026 14:08',
  );

  it('CSV quotes cells and neutralises formulas', () => {
    const csv = exportTableToCsv(table);
    expect(
      csv.startsWith('\uFEFFAvailability,Address,Town,Size,Rent or price'),
    ).toBe(true);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('"£25,000 pa"');
  });

  it('Excel sheet is flat', () => {
    expect(exportTableToSheet(table).rows).toHaveLength(4);
  });

  it('print view escapes html and shows group headings', () => {
    const html = renderExportHtml(toTextTable(table));
    expect(html).toContain('<tr class="group"><td colspan="5">To let');
    expect(html).not.toContain('<script');
    const evil = buildDisposalsExportTable(
      {
        ...input(),
        listings: [
          {
            id: 'x',
            status: 'marketing',
            disposal_type: 'to_let',
            address_line_1: '<b>x</b>',
            town: 'T',
          },
        ],
      },
      options(),
      'now',
    );
    expect(renderExportHtml(toTextTable(evil))).toContain(
      '&lt;b&gt;x&lt;/b&gt;',
    );
  });

  it('PDF builds a valid document', async () => {
    const bytes = await buildExportPdf(toTextTable(table));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});
