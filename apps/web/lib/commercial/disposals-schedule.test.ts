import { describe, expect, it } from 'vitest';

import { unzipBuffer } from '~/lib/building-surveyor/xlsx-min';
import {
  buildXlsxWorkbook,
  toExcelSerial,
} from '~/lib/spreadsheet/xlsx-workbook';

import {
  buildDisposalsScheduleSheets,
  filterScheduleListingsForUser,
  humanize,
} from './disposals-schedule';

function input() {
  return {
    listings: [
      {
        id: 'l2',
        name: 'Zeta House',
        status: 'let',
        disposal_type: 'to_let',
        asking_rent_pence: 1250000,
        key_points: ['Lift', 'Parking'],
        available_from: '2026-10-01',
      },
      {
        id: 'l1',
        name: 'Alpha Park',
        status: 'marketing',
        disposal_type: 'for_sale',
        asking_price_pence: 50000000,
        asking_price_qualifier: 'guide_price',
        account_branch_id: 'b1',
        instructing_client_id: 'c1',
        assigned_to: 'u2',
      },
    ],
    units: [
      {
        id: 'u-1',
        listing_id: 'l1',
        label: 'Unit 1',
        size_sqft: 1200,
        sort_order: 1,
      },
      {
        id: 'u-0',
        listing_id: 'l1',
        label: 'Unit 0',
        size_sqft: 800,
        sort_order: 0,
      },
    ],
    agents: [
      { listing_id: 'l1', user_id: 'u1', sort_order: 0 },
      { listing_id: 'l1', user_id: 'u2', sort_order: 1 },
    ],
    coAgents: [
      {
        listing_id: 'l1',
        contact_name: 'Sam',
        clients: { company_name: 'Joint & Co' },
      },
    ],
    parties: [
      {
        listing_id: 'l1',
        role: 'landlord',
        contact_email: 'll@example.com',
        clients: { company_name: 'Landlord Ltd' },
      },
      {
        listing_id: 'l1',
        role: 'solicitor',
        contacts: { full_name: 'Jo Law' },
      },
    ],
    memberNames: new Map([
      ['u1', 'Dan'],
      ['u2', 'Mick'],
    ]),
    branchNames: new Map([['b1', 'Maidstone']]),
    clientNames: new Map([['c1', 'Acme Estates']]),
  };
}

function cell(
  sheet: ReturnType<typeof buildDisposalsScheduleSheets>[number],
  rowIndex: number,
  header: string,
) {
  const col = sheet.columns.findIndex((column) => column.header === header);
  expect(col).toBeGreaterThanOrEqual(0);
  return sheet.rows[rowIndex]?.[col];
}

describe('buildDisposalsScheduleSheets', () => {
  it('orders disposals by pipeline status and resolves names', () => {
    const [disposals] = buildDisposalsScheduleSheets(input());
    expect(disposals!.name).toBe('Disposals');
    expect(cell(disposals!, 0, 'Name')).toBe('Alpha Park');
    expect(cell(disposals!, 1, 'Name')).toBe('Zeta House');

    expect(cell(disposals!, 0, 'Status')).toBe('Marketing');
    expect(cell(disposals!, 0, 'Office')).toBe('Maidstone');
    expect(cell(disposals!, 0, 'Acting agents')).toBe('Dan, Mick');
    expect(cell(disposals!, 0, 'Assigned to')).toBe('Mick');
    expect(cell(disposals!, 0, 'Instructing client')).toBe('Acme Estates');
    expect(cell(disposals!, 0, 'Landlord')).toBe(
      'Landlord Ltd (ll@example.com)',
    );
    expect(cell(disposals!, 0, 'Other parties')).toBe('Solicitor: Jo Law');
    expect(cell(disposals!, 0, 'Joint agents')).toBe('Joint & Co (Sam)');
    expect(cell(disposals!, 0, 'Units')).toBe(2);
    expect(cell(disposals!, 0, 'Asking price (£)')).toBe(500000);
    expect(cell(disposals!, 0, 'Price qualifier')).toBe('Guide Price');
  });

  it('converts pence to pounds and lists key points', () => {
    const [disposals] = buildDisposalsScheduleSheets(input());
    expect(cell(disposals!, 1, 'Asking rent (£)')).toBe(12500);
    expect(cell(disposals!, 1, 'Price qualifier')).toBeNull();
    expect(cell(disposals!, 1, 'Key points')).toBe('Lift\nParking');
    expect(cell(disposals!, 1, 'Available from')).toBe('2026-10-01');
  });

  it('lists units under their disposal in sort order', () => {
    const [, units] = buildDisposalsScheduleSheets(input());
    expect(units!.name).toBe('Units');
    expect(units!.rows).toHaveLength(2);
    expect(cell(units!, 0, 'Disposal')).toBe('Alpha Park');
    expect(cell(units!, 0, 'Unit')).toBe('Unit 0');
    expect(cell(units!, 1, 'Size (sq ft)')).toBe(1200);
  });
});

describe('filterScheduleListingsForUser', () => {
  const listings = [
    { id: 'open', restrict_access_to_assigned: false },
    { id: 'mine', restrict_access_to_assigned: true, pa_user_id: 'me' },
    { id: 'agent', restrict_access_to_assigned: true },
    { id: 'hidden', restrict_access_to_assigned: true, assigned_to: 'other' },
  ];
  const agents = [
    { listing_id: 'agent', user_id: 'me' },
    { listing_id: 'hidden', user_id: 'other' },
  ];

  it('hides restricted disposals the user is not on', () => {
    expect(
      filterScheduleListingsForUser({
        listings,
        agents,
        userId: 'me',
        canSeeRestricted: false,
      }).map((row) => row.id),
    ).toEqual(['open', 'mine', 'agent']);
  });

  it('keeps everything for owners and admins', () => {
    expect(
      filterScheduleListingsForUser({
        listings,
        agents,
        userId: 'me',
        canSeeRestricted: true,
      }),
    ).toHaveLength(4);
  });
});

describe('humanize', () => {
  it('turns tokens into sentence case', () => {
    expect(humanize('to_let_and_for_sale')).toBe('To let and for sale');
    expect(humanize('')).toBeNull();
  });
});

describe('buildXlsxWorkbook', () => {
  it('writes a valid multi-sheet package', () => {
    const buffer = buildXlsxWorkbook(buildDisposalsScheduleSheets(input()));
    const entries = new Map(
      unzipBuffer(buffer).map((entry) => [
        entry.name,
        entry.data.toString('utf8'),
      ]),
    );

    expect([...entries.keys()]).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        'xl/workbook.xml',
        'xl/styles.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
      ]),
    );
    expect(entries.get('xl/workbook.xml')).toContain('name="Disposals"');
    expect(entries.get('xl/workbook.xml')).toContain('name="Units"');

    const sheet1 = entries.get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet1).toContain('Joint &amp; Co (Sam)');
    expect(sheet1).toContain('state="frozen"');
    expect(sheet1).toContain('<autoFilter ref="A1:');
  });

  it('strips characters XML cannot hold', () => {
    const buffer = buildXlsxWorkbook([
      {
        name: 'Test',
        columns: [{ header: 'Text' }],
        rows: [['bad\u0001char']],
      },
    ]);
    const sheet = unzipBuffer(buffer)
      .find((entry) => entry.name === 'xl/worksheets/sheet1.xml')
      ?.data.toString('utf8');
    expect(sheet).toContain('badchar');
  });
});

describe('toExcelSerial', () => {
  it('maps ISO dates to Excel serial days', () => {
    expect(toExcelSerial('1900-03-01', false)).toBe(61);
    expect(toExcelSerial('2026-09-29', false)).toBe(46294);
    expect(toExcelSerial('not a date', false)).toBeNull();
  });
});
