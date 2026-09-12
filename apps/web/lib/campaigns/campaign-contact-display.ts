import { parseCampaignSubscriberStatus } from './campaign-status';
import type {
  CampaignContactListMembership,
  CampaignSubscriberStatus,
  CampaignWorkspaceContact,
} from './campaign.types';

/** How many list-name pills to show before collapsing the rest into “+N”. */
export const CAMPAIGN_CONTACT_LIST_CHIP_LIMIT = 2;

export function visibleNamedChips<T>(
  items: T[],
  maxVisible = CAMPAIGN_CONTACT_LIST_CHIP_LIMIT,
): { visible: T[]; overflow: number } {
  const limit = Math.max(0, maxVisible);
  if (items.length <= limit) {
    return { visible: items, overflow: 0 };
  }

  return {
    visible: items.slice(0, limit),
    overflow: items.length - limit,
  };
}

export function listsByContactId(
  rows: Array<{ contactId: string; listId: string; listName: string }>,
): Map<string, CampaignContactListMembership[]> {
  const byContact = new Map<string, CampaignContactListMembership[]>();

  for (const row of rows) {
    const current = byContact.get(row.contactId) ?? [];
    if (current.some((list) => list.id === row.listId)) {
      continue;
    }
    current.push({ id: row.listId, name: row.listName });
    byContact.set(row.contactId, current);
  }

  for (const lists of byContact.values()) {
    lists.sort((a, b) => a.name.localeCompare(b.name));
  }

  return byContact;
}

export function subscriberStatusByEmail(
  rows: Array<{ email: string; marketingStatus: unknown }>,
): Map<string, CampaignSubscriberStatus> {
  const byEmail = new Map<string, CampaignSubscriberStatus>();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, parseCampaignSubscriberStatus(row.marketingStatus));
  }

  return byEmail;
}

export function enrichCampaignContacts(
  contacts: CampaignWorkspaceContact[],
  input: {
    categoryByContact?: Map<string, string[]>;
    memberships?: Array<{
      contactId: string;
      listId: string;
      listName: string;
    }>;
    preferences?: Array<{ email: string; marketingStatus: unknown }>;
  },
): CampaignWorkspaceContact[] {
  const lists = listsByContactId(input.memberships ?? []);
  const statuses = subscriberStatusByEmail(input.preferences ?? []);

  return contacts.map((contact) => {
    const email = contact.email?.trim().toLowerCase() ?? '';
    return {
      ...contact,
      categoryIds:
        input.categoryByContact?.get(contact.id) ?? contact.categoryIds,
      lists: lists.get(contact.id) ?? [],
      subscriberStatus: email ? (statuses.get(email) ?? 'none') : 'none',
    };
  });
}
