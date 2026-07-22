import { describe, expect, it } from 'vitest';

import {
  buildLinkedInClientDrafts,
  buildLinkedInPipelineDrafts,
  isLinkedInConnectionsCsv,
  linkedInRecordToClientDraft,
  parseLinkedInConnections,
} from './linkedin-import';

const LINKEDIN_HEADERS = [
  'First Name',
  'Last Name',
  'Email Address',
  'Company',
  'Position',
  'Connected On',
];

describe('linkedin import', () => {
  it('detects LinkedIn connection exports', () => {
    expect(isLinkedInConnectionsCsv(LINKEDIN_HEADERS)).toBe(true);
    expect(isLinkedInConnectionsCsv(['Name', 'Email'])).toBe(false);
  });

  it('parses LinkedIn rows into normalized records', () => {
    const records = parseLinkedInConnections(LINKEDIN_HEADERS, [
      [
        'Alex',
        'Morgan',
        'alex@example.com',
        'Acme Ltd',
        'Founder',
        '2024-01-15',
      ],
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex@example.com',
      company: 'Acme Ltd',
      position: 'Founder',
      connectedOn: '2024-01-15',
    });
  });

  it('creates business clients with a primary contact when company is present', () => {
    const [record] = parseLinkedInConnections(LINKEDIN_HEADERS, [
      ['Alex', 'Morgan', '', 'Acme Ltd', 'Founder', '2024-01-15'],
    ]);

    const draft = linkedInRecordToClientDraft(0, record!);
    expect(draft.clientType).toBe('business');
    expect(draft.companyName).toBe('Acme Ltd');
    expect(draft.contact).toMatchObject({
      firstName: 'Alex',
      lastName: 'Morgan',
      role: 'Founder',
    });
  });

  it('builds pipeline drafts with contact and company names', () => {
    const drafts = buildLinkedInPipelineDrafts(LINKEDIN_HEADERS, [
      ['Jordan', 'Lee', '', 'Northwind', 'Director', '2024-02-01'],
    ]);

    expect(drafts[0]).toMatchObject({
      contactName: 'Jordan Lee',
      companyName: 'Northwind',
      position: 'Director',
      warnings: expect.arrayContaining([
        'No email — LinkedIn only includes emails when shared',
      ]),
    });
  });

  it('creates individual client drafts when no company is present', () => {
    const drafts = buildLinkedInClientDrafts(LINKEDIN_HEADERS, [
      ['Jordan', 'Lee', 'jordan@example.com', '', '', '2024-02-01'],
    ]);

    expect(drafts[0]?.clientType).toBe('individual');
    expect(drafts[0]?.firstName).toBe('Jordan');
    expect(drafts[0]?.email).toBe('jordan@example.com');
  });
});
