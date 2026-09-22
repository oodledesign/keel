import { describe, expect, it } from 'vitest';

import {
  additionalRecipientsCampaignName,
  duplicateCampaignName,
  filterAdditionalRecipients,
} from './campaign-duplicate';

describe('duplicateCampaignName', () => {
  it('appends a copy suffix within 160 chars', () => {
    expect(duplicateCampaignName('Launch')).toBe('Launch (copy)');
    expect(duplicateCampaignName('  ')).toBe('Campaign (copy)');
    const long = 'A'.repeat(160);
    const named = duplicateCampaignName(long);
    expect(named.endsWith(' (copy)')).toBe(true);
    expect(named.length).toBeLessThanOrEqual(160);
  });
});

describe('additionalRecipientsCampaignName', () => {
  it('appends an additional suffix within 160 chars', () => {
    expect(additionalRecipientsCampaignName('Launch')).toBe(
      'Launch (additional)',
    );
    const named = additionalRecipientsCampaignName('B'.repeat(160));
    expect(named.endsWith(' (additional)')).toBe(true);
    expect(named.length).toBeLessThanOrEqual(160);
  });
});

describe('filterAdditionalRecipients', () => {
  const clients = [
    { id: 'client-ada', email: 'ada@example.com' },
    { id: 'client-new', email: 'new.client@example.com' },
  ];
  const contacts = [
    { id: 'contact-bob', email: 'bob@example.com' },
    { id: 'contact-new', email: 'New.Contact@example.com' },
  ];

  it('keeps only people who were not on the original send', () => {
    expect(
      filterAdditionalRecipients({
        emails: ['ada@example.com', 'paste@example.com', 'paste@example.com'],
        selectedClientIds: ['client-ada', 'client-new'],
        selectedContactIds: ['contact-bob', 'contact-new', 'missing'],
        clients,
        contacts,
        alreadySentEmails: ['Ada@Example.com', 'bob@example.com'],
      }),
    ).toEqual({
      emails: ['paste@example.com'],
      clientIds: ['client-new'],
      contactIds: ['contact-new'],
      skippedAlreadySent: 2,
    });
  });

  it('keeps everyone when nobody was sent yet', () => {
    expect(
      filterAdditionalRecipients({
        emails: ['paste@example.com'],
        selectedClientIds: ['client-new'],
        selectedContactIds: ['contact-new'],
        clients,
        contacts,
        alreadySentEmails: [],
      }),
    ).toEqual({
      emails: ['paste@example.com'],
      clientIds: ['client-new'],
      contactIds: ['contact-new'],
      skippedAlreadySent: 0,
    });
  });

  it('returns an empty audience when nothing was picked', () => {
    expect(
      filterAdditionalRecipients({
        emails: [],
        selectedClientIds: [],
        selectedContactIds: [],
        clients,
        contacts,
        alreadySentEmails: ['ada@example.com'],
      }),
    ).toEqual({
      emails: [],
      clientIds: [],
      contactIds: [],
      skippedAlreadySent: 0,
    });
  });

  it('does not count an unknown id as already sent', () => {
    expect(
      filterAdditionalRecipients({
        emails: [],
        selectedClientIds: ['missing'],
        selectedContactIds: [],
        clients,
        contacts,
        alreadySentEmails: ['ada@example.com'],
      }),
    ).toEqual({
      emails: [],
      clientIds: [],
      contactIds: [],
      skippedAlreadySent: 0,
    });
  });
});
