export const EMAIL_RECIPIENT_LISTS = [
  'all_users',
  'tier_1',
  'tier_2',
  'tier_3',
  'business_owners',
  'inactive',
  'beta_users',
  'no_subscription',
  'pre_signup_contacts',
  'beta_contacts',
  'contact_list',
  'manual',
  'custom',
] as const;

export type EmailRecipientList = (typeof EMAIL_RECIPIENT_LISTS)[number];

/** URL / membership key for a custom contact list (`cl:<uuid>`). */
export const CUSTOM_LIST_KEY_PREFIX = 'cl:';

export function customListKey(listId: string) {
  return `${CUSTOM_LIST_KEY_PREFIX}${listId}`;
}

export function isCustomListKey(list: string) {
  return list.startsWith(CUSTOM_LIST_KEY_PREFIX);
}

export function parseCustomListId(list: string): string | null {
  if (!isCustomListKey(list)) return null;
  const id = list.slice(CUSTOM_LIST_KEY_PREFIX.length).trim();
  return id || null;
}

export type CustomContactListRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export const RECIPIENT_LIST_LABELS: Record<EmailRecipientList, string> = {
  all_users: 'All users',
  tier_1: 'Community workspaces',
  tier_2: 'Business workspaces',
  tier_3: 'Property workspaces',
  business_owners: 'Workspace owners',
  inactive: 'Inactive users',
  beta_users: 'Early adopters',
  no_subscription: 'No active plan',
  pre_signup_contacts: 'Pre-signup contacts',
  beta_contacts: 'Beta contacts',
  contact_list: 'Custom contact list',
  manual: 'Manual addresses',
  custom: 'Custom users',
};

export const RECIPIENT_LIST_DESCRIPTIONS: Record<EmailRecipientList, string> = {
  all_users: 'Every registered user who has not unsubscribed.',
  tier_1: 'Owners/admins of workspaces with a Community plan entitlement.',
  tier_2: 'Owners/admins of workspaces with a Business plan entitlement.',
  tier_3: 'Owners/admins of workspaces with a Property plan entitlement.',
  business_owners: 'Workspace owners and admins across all teams.',
  inactive: 'Users who have not signed in during the last 30 days.',
  beta_users: 'Users who signed up before 8 June 2025.',
  no_subscription: 'Registered users with no active workspace entitlement.',
  pre_signup_contacts: 'Marketing contacts who have not signed up yet.',
  beta_contacts:
    'Beta invite list added from Admin → Email marketing (no auto-email on add).',
  contact_list: 'A custom list you created under Email marketing → Lists.',
  manual: 'Addresses pasted into a specific campaign — not a stored list.',
  custom: 'Hand-picked users selected when composing a campaign.',
};

export type RecipientListMember = {
  email: string;
  name: string | null;
  kind: 'user' | 'contact';
  userId?: string | null;
  contactId?: string | null;
  tier?: string | null;
  lastSignInAt?: string | null;
  trade?: string | null;
};

export type RecipientListSummary = {
  list: string;
  label: string;
  description: string;
  count: number;
  campaignSpecific: boolean;
  editable?: boolean;
  deletable?: boolean;
  customListId?: string;
};

export type EmailCampaignRow = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  title: string;
  subject: string;
  preview_text: string | null;
  html_body: string;
  plain_text_body: string | null;
  template_id: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  recipient_list: EmailRecipientList;
  contact_list_id: string | null;
  custom_recipient_ids: string[] | null;
  manual_recipient_emails: string[] | null;
  total_recipients: number;
  sent_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
};
