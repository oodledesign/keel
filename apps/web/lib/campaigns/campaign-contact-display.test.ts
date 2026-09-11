import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_CONTACT_LIST_CHIP_LIMIT,
  enrichCampaignContacts,
  listsByContactId,
  subscriberStatusByEmail,
  visibleNamedChips,
} from './campaign-contact-display';
import type { CampaignWorkspaceContact } from './campaign.types';

function contact(
  overrides: Partial<CampaignWorkspaceContact> = {},
): CampaignWorkspaceContact {
  return {
    id: 'c1',
    accountId: 'a1',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    fullName: 'Ada Lovelace',
    phone: null,
    companyName: null,
    industry: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    categoryIds: [],
    lists: [],
    subscriberStatus: 'none',
    ...overrides,
  };
}

describe('campaign contact display helpers', () => {
  it('shows every list when there are two or fewer', () => {
    expect(visibleNamedChips(['a', 'b'])).toEqual({
      visible: ['a', 'b'],
      overflow: 0,
    });
    expect(CAMPAIGN_CONTACT_LIST_CHIP_LIMIT).toBe(2);
  });

  it('keeps two pills and reports +N for extra lists', () => {
    expect(visibleNamedChips(['Press', 'VIP', 'Q1', 'Alumni'])).toEqual({
      visible: ['Press', 'VIP'],
      overflow: 2,
    });
  });

  it('dedupes and sorts list memberships by name', () => {
    const byContact = listsByContactId([
      { contactId: 'c1', listId: 'l2', listName: 'VIP' },
      { contactId: 'c1', listId: 'l1', listName: 'Alumni' },
      { contactId: 'c1', listId: 'l2', listName: 'VIP' },
    ]);

    expect(byContact.get('c1')).toEqual([
      { id: 'l1', name: 'Alumni' },
      { id: 'l2', name: 'VIP' },
    ]);
  });

  it('maps preference emails case-insensitively', () => {
    const statuses = subscriberStatusByEmail([
      { email: 'Ada@Example.com', marketingStatus: 'unsubscribed' },
      { email: '  ', marketingStatus: 'subscribed' },
    ]);

    expect(statuses.get('ada@example.com')).toBe('unsubscribed');
    expect(statuses.size).toBe(1);
  });

  it('attaches lists and preference status without N+1 shape', () => {
    const rows = enrichCampaignContacts(
      [
        contact({ id: 'c1', email: 'ada@example.com' }),
        contact({
          id: 'c2',
          email: 'no-pref@example.com',
          fullName: 'No Pref',
        }),
        contact({
          id: 'c3',
          email: null,
          fullName: 'No Email',
        }),
      ],
      {
        memberships: [
          { contactId: 'c1', listId: 'l1', listName: 'Press' },
          { contactId: 'c1', listId: 'l2', listName: 'VIP' },
        ],
        preferences: [
          { email: 'ada@example.com', marketingStatus: 'subscribed' },
        ],
      },
    );

    expect(rows[0]?.lists.map((list) => list.name)).toEqual(['Press', 'VIP']);
    expect(rows[0]?.subscriberStatus).toBe('subscribed');
    expect(rows[1]?.lists).toEqual([]);
    expect(rows[1]?.subscriberStatus).toBe('none');
    expect(rows[2]?.subscriberStatus).toBe('none');
  });
});
