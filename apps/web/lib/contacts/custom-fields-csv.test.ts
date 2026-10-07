import { describe, expect, it } from 'vitest';

import type { ContactCustomFieldDefinition } from './custom-fields';
import {
  buildClientsExportCsv,
  extractCustomValues,
  normalizeCustomMapping,
  suggestCustomFieldMapping,
} from './custom-fields-csv';

const defs: ContactCustomFieldDefinition[] = [
  {
    id: '1',
    key: 'budget',
    label: 'Budget',
    fieldType: 'number',
    options: [],
    position: 0,
  },
  {
    id: '2',
    key: 'vip',
    label: 'VIP client',
    fieldType: 'checkbox',
    options: [],
    position: 1,
  },
];

describe('custom field CSV helpers', () => {
  it('suggests mappings from header labels without clobbering existing ones', () => {
    const mapping = suggestCustomFieldMapping(
      ['Email', 'budget', 'vip client', 'Other'],
      {
        Email: 'email',
        budget: '__skip__',
        'vip client': '__skip__',
        Other: '__skip__',
      },
      defs,
    );
    expect(mapping).toEqual({
      Email: 'email',
      budget: 'custom:budget',
      'vip client': 'custom:vip',
      Other: '__skip__',
    });
  });

  it('drops mappings to deleted custom fields', () => {
    expect(
      normalizeCustomMapping({ A: 'custom:gone', B: 'custom:vip' }, defs),
    ).toEqual({ A: '__skip__', B: 'custom:vip' });
  });

  it('extracts custom columns from a mapped record', () => {
    expect(
      extractCustomValues({ email: 'a@b.co', 'custom:budget': '500' }),
    ).toEqual({ budget: '500' });
  });

  it('exports standard and custom columns, neutralising formulas', () => {
    const csv = buildClientsExportCsv(
      [
        {
          client_type: 'individual',
          company_name: null,
          first_name: '=cmd',
          last_name: 'Smith',
          email: 'a@b.co',
          phone: null,
          address_line_1: null,
          address_line_2: null,
          city: null,
          postcode: null,
          country: null,
          custom_fields: { budget: 500, vip: true },
        },
      ],
      defs,
    );
    const [header, row] = csv.trim().split('\n');
    expect(header?.endsWith('Budget,VIP client')).toBe(true);
    expect(row).toContain("'=cmd");
    expect(row?.endsWith('500,Yes')).toBe(true);
  });
});
