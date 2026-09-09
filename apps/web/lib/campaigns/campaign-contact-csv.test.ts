import { describe, expect, it } from 'vitest';

import { CSV_SKIP_FIELD } from '~/lib/csv/rows-to-records';

import {
  heuristicCampaignContactMapping,
  parseCampaignContactCsvRows,
  summarizeCampaignContactCsvDrafts,
} from './campaign-contact-csv';

describe('campaign contact csv', () => {
  it('maps email and name columns heuristically', () => {
    const { mapping } = heuristicCampaignContactMapping([
      'Email Address',
      'First Name',
      'Last Name',
      'Company',
      'Industry',
      'Notes',
    ]);
    expect(mapping['Email Address']).toBe('email');
    expect(mapping['First Name']).toBe('first_name');
    expect(mapping['Last Name']).toBe('last_name');
    expect(mapping.Company).toBe('company_name');
    expect(mapping.Industry).toBe('industry');
    expect(mapping.Notes).toBe(CSV_SKIP_FIELD);
  });

  it('rejects invalid rows without dropping valid ones', () => {
    const drafts = parseCampaignContactCsvRows(
      ['email', 'name'],
      [
        ['ada@example.com', 'Ada Lovelace'],
        ['not-an-email', 'Bad row'],
        ['', 'Missing'],
        ['BOB@Example.COM', 'Bob'],
      ],
      { email: 'email', name: 'full_name' },
    );
    const summary = summarizeCampaignContactCsvDrafts(drafts);

    expect(summary.validCount).toBe(2);
    expect(summary.errorCount).toBe(2);
    expect(summary.valid.map((row) => row.email)).toEqual([
      'ada@example.com',
      'bob@example.com',
    ]);
    expect(summary.invalid.every((row) => row.errors.length > 0)).toBe(true);
  });

  it('maps industry from a CSV column', () => {
    const drafts = parseCampaignContactCsvRows(
      ['email', 'industry'],
      [['ada@example.com', 'Technology']],
      { email: 'email', industry: 'industry' },
    );
    expect(drafts[0]?.industry).toBe('Technology');
    expect(drafts[0]?.errors).toEqual([]);
  });
});
