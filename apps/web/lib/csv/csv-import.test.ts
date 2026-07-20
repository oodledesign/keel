import { describe, expect, it } from 'vitest';

import {
  buildClientImportTemplateCsv,
  heuristicClientMapping,
} from '~/lib/ai/client-csv-fields';
import {
  buildTaskImportTemplateCsv,
  heuristicTaskMapping,
} from '~/lib/ai/task-csv-fields';
import {
  findClientDuplicate,
  inferClientType,
  validateClientImportDraft,
} from '~/lib/clients/client-import';
import { parseCsv } from '~/lib/csv/parse-csv';
import { parseUkDate } from '~/lib/csv/parse-date';
import {
  CSV_SKIP_FIELD,
  applyCsvColumnMapping,
} from '~/lib/csv/rows-to-records';

describe('parseCsv', () => {
  it('parses headers and quoted commas', () => {
    const { headers, rows } = parseCsv(
      'Name,Notes\n"Acme, Ltd",Hello\nBeta,World\n',
    );
    expect(headers).toEqual(['Name', 'Notes']);
    expect(rows).toEqual([
      ['Acme, Ltd', 'Hello'],
      ['Beta', 'World'],
    ]);
  });

  it('returns empty for header-only', () => {
    expect(parseCsv('a,b\n')).toEqual({ headers: [], rows: [] });
  });
});

describe('applyCsvColumnMapping', () => {
  it('maps columns and skips empty rows', () => {
    const records = applyCsvColumnMapping(
      ['Company', 'Email', 'Ignore'],
      [
        ['Acme', 'a@x.com', 'x'],
        ['', '', ''],
      ],
      {
        Company: 'company_name',
        Email: 'email',
        Ignore: CSV_SKIP_FIELD,
      },
    );
    expect(records).toEqual([{ company_name: 'Acme', email: 'a@x.com' }]);
  });
});

describe('heuristicClientMapping', () => {
  it('maps common client headers', () => {
    const result = heuristicClientMapping([
      'Company Name',
      'Email Address',
      'Phone',
      'First Name',
    ]);
    expect(result.mapping['Company Name']).toBe('company_name');
    expect(result.mapping['Email Address']).toBe('email');
    expect(result.mapping['Phone']).toBe('phone');
    expect(result.mapping['First Name']).toBe('first_name');
  });
});

describe('heuristicTaskMapping', () => {
  it('maps title and due date', () => {
    const result = heuristicTaskMapping(['Task', 'Due Date', 'Client']);
    expect(result.mapping['Task']).toBe('title');
    expect(result.mapping['Due Date']).toBe('due_date');
    expect(result.mapping['Client']).toBe('client_name');
  });
});

describe('import templates', () => {
  it('builds client template that parses and maps', () => {
    const { headers, rows } = parseCsv(buildClientImportTemplateCsv());
    expect(headers).toContain('Company name');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const mapped = heuristicClientMapping(headers);
    expect(mapped.mapping['Company name']).toBe('company_name');
    expect(mapped.mapping['Email']).toBe('email');
  });

  it('builds task template that parses and maps', () => {
    const { headers, rows } = parseCsv(buildTaskImportTemplateCsv());
    expect(headers).toContain('Title');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const mapped = heuristicTaskMapping(headers);
    expect(mapped.mapping['Title']).toBe('title');
    expect(mapped.mapping['Due date']).toBe('due_date');
  });
});

describe('client import duplicates', () => {
  it('infers business vs individual', () => {
    expect(inferClientType({ companyName: 'Acme', firstName: null })).toBe(
      'business',
    );
    expect(inferClientType({ companyName: null, firstName: 'Sam' })).toBe(
      'individual',
    );
  });

  it('validates required fields', () => {
    expect(
      validateClientImportDraft({
        rowIndex: 0,
        clientType: 'business',
        companyName: null,
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postcode: null,
        country: null,
        contact: null,
      }),
    ).toContain('Company name is required for business clients');
  });

  it('matches by email', () => {
    const match = findClientDuplicate(
      {
        rowIndex: 1,
        clientType: 'business',
        companyName: 'Other',
        firstName: null,
        lastName: null,
        email: 'A@X.com',
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postcode: null,
        country: null,
        contact: null,
        errors: [],
      },
      [
        {
          id: 'c1',
          displayName: 'Acme',
          email: 'a@x.com',
          companyName: 'Acme',
          firstName: null,
          lastName: null,
          clientType: 'business',
        },
      ],
    );
    expect(match?.existing.id).toBe('c1');
    expect(match?.matchReason).toBe('email');
  });
});

describe('parseUkDate', () => {
  it('parses DD/MM/YYYY', () => {
    expect(parseUkDate('20/07/2026')).toBe('2026-07-20');
  });
});
