import 'server-only';

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  prepareCampaignHtmlForDelivery,
  wrapCampaignHtmlForEmailClients,
} from '~/lib/admin-email/campaign-html';
import { personalizeCampaignMergeTags } from '~/lib/email-templates/marketing-campaign-shell';
import { htmlToPlainText } from '~/lib/email/html-to-plain-text';
import {
  getTransactionalEmailSender,
  sendTransactionalEmail,
} from '~/lib/email/zeptomail-client';

import {
  CUSTOM_LIST_KEY_PREFIX,
  type CustomContactListRow,
  EMAIL_RECIPIENT_LISTS,
  type EmailCampaignRow,
  type EmailRecipientList,
  RECIPIENT_LIST_DESCRIPTIONS,
  RECIPIENT_LIST_LABELS,
  type RecipientListMember,
  type RecipientListSummary,
  customListKey,
  isCustomListKey,
  parseCustomListId,
} from './recipient-lists';

export {
  CUSTOM_LIST_KEY_PREFIX,
  EMAIL_RECIPIENT_LISTS,
  RECIPIENT_LIST_DESCRIPTIONS,
  RECIPIENT_LIST_LABELS,
  customListKey,
  isCustomListKey,
  parseCustomListId,
  type CustomContactListRow,
  type EmailCampaignRow,
  type EmailRecipientList,
  type RecipientListMember,
  type RecipientListSummary,
};

export type CampaignRecipient = {
  email: string;
  firstName?: string | null;
  recipientId?: string | null;
  contactId?: string | null;
};

type AuthUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: {
    first_name?: unknown;
    firstName?: unknown;
    name?: unknown;
    full_name?: unknown;
  } | null;
};

type DbClient = {
  from: (table: string) => any;
  auth: {
    admin: {
      listUsers: (params: { page?: number; perPage?: number }) => Promise<{
        data: { users: AuthUser[] };
        error: { message: string } | null;
      }>;
    };
  };
};

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 100;
const BETA_CUTOFF = new Date('2025-06-08T00:00:00.000Z');

function getAdminClient() {
  return getSupabaseServerAdminClient() as unknown as DbClient;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function firstNameFromAuthUser(user: AuthUser): string | null {
  const metadata = user.user_metadata;
  const explicit =
    typeof metadata?.first_name === 'string'
      ? metadata.first_name
      : typeof metadata?.firstName === 'string'
        ? metadata.firstName
        : '';

  if (explicit.trim()) {
    return explicit.trim().split(/\s+/)[0] ?? null;
  }

  const displayName =
    typeof metadata?.name === 'string'
      ? metadata.name
      : typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : '';

  return displayName.trim().split(/\s+/)[0] || null;
}

export function parseManualEmails(input: string | string[] | null | undefined) {
  const values = Array.isArray(input) ? input : (input ?? '').split(/[\n,;]/);

  return [
    ...new Set(
      values.map(normalizeEmail).filter((email) => /\S+@\S+\.\S+/.test(email)),
    ),
  ];
}

export function encodeUnsubscribeToken(email: string) {
  return Buffer.from(normalizeEmail(email), 'utf8').toString('base64url');
}

export function decodeUnsubscribeToken(token: string) {
  try {
    const email = Buffer.from(token, 'base64url').toString('utf8');
    return /\S+@\S+\.\S+/.test(email) ? normalizeEmail(email) : null;
  } catch {
    return null;
  }
}

function getPublicBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.replace(/\/+$/, '') ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ??
    'http://localhost:3000'
  );
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ?? getPublicBaseUrl()
  );
}

function getCampaignSigningSecret() {
  return (
    process.env.CAMPAIGN_EMAIL_SIGNING_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    'keel-campaign-view-dev'
  );
}

export function signCampaignViewToken(params: {
  campaignId: string;
  metricId: string;
  email: string;
}) {
  const payload = [
    params.campaignId,
    params.metricId,
    normalizeEmail(params.email),
  ].join(':');

  return createHmac('sha256', getCampaignSigningSecret())
    .update(payload)
    .digest('base64url');
}

function verifyCampaignViewToken(params: {
  campaignId: string;
  metricId: string;
  email: string;
  signature: string;
}) {
  const expected = signCampaignViewToken(params);
  const left = Buffer.from(expected);
  const right = Buffer.from(params.signature);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function buildCampaignViewUrl(params: {
  campaignId: string;
  metricId: string;
  email: string;
}) {
  const query = new URLSearchParams({
    cid: params.campaignId,
    rid: params.metricId,
    sig: signCampaignViewToken(params),
  });

  return `${getAppBaseUrl()}/email/campaign/view?${query.toString()}`;
}

function buildUnsubscribeUrl(email: string) {
  return `${getPublicBaseUrl()}/unsubscribe?token=${encodeUnsubscribeToken(email)}`;
}

function buildCampaignPlainTextBody(params: {
  previewText?: string | null;
  html: string;
  viewUrl: string;
  unsubscribeUrl: string;
  plainTextOverride?: string | null;
}) {
  if (params.plainTextOverride?.trim()) {
    return [
      `View this email in your browser:\n${params.viewUrl}`,
      params.plainTextOverride.trim(),
      `Unsubscribe: ${params.unsubscribeUrl}`,
    ].join('\n\n');
  }

  return [
    params.previewText?.trim(),
    `View this email in your browser:\n${params.viewUrl}`,
    htmlToPlainText(params.html),
    `Unsubscribe: ${params.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function renderViewInBrowserBanner(viewUrl: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef1f4;margin:0;padding:0;border-collapse:collapse;"><tr><td align="center" style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#667085;">Having trouble viewing this email? <a href="${viewUrl}" style="color:#1A3A2E;font-weight:700;text-decoration:underline;">View it in your browser</a>.</td></tr></table>`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listAuthUsers(admin: DbClient) {
  const users: AuthUser[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(error.message);
    }

    users.push(...(data.users ?? []));

    if ((data.users ?? []).length < 1000) {
      break;
    }

    page += 1;
  }

  return users.filter((user) => user.email);
}

async function getUnsubscribedEmails(admin: DbClient) {
  const { data, error } = await admin
    .from('email_unsubscribes')
    .select('email');

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    ((data ?? []) as Array<{ email: string }>).map((row) =>
      normalizeEmail(row.email),
    ),
  );
}

function uniqueRecipients(recipients: CampaignRecipient[]) {
  const byEmail = new Map<string, CampaignRecipient>();

  for (const recipient of recipients) {
    const email = normalizeEmail(recipient.email);
    if (!byEmail.has(email)) {
      byEmail.set(email, { ...recipient, email });
    }
  }

  return [...byEmail.values()];
}

async function resolveTierUserIds(admin: DbClient) {
  const now = new Date().toISOString();

  const { data: memberships, error: membershipError } = await admin
    .from('accounts_memberships')
    .select('user_id, account_role, account_id');

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const businessOwnerIds = new Set<string>();

  for (const row of (memberships ?? []) as Array<{
    user_id: string;
    account_role: string | null;
  }>) {
    if (row.account_role === 'admin' || row.account_role === 'owner') {
      businessOwnerIds.add(row.user_id);
    }
  }

  const { data: entitlements, error: entError } = await admin
    .from('account_entitlements')
    .select('account_id, entitlement_key, expires_at');

  if (entError) {
    throw new Error(entError.message);
  }

  const tierByAccount = new Map<string, string>();

  for (const row of (entitlements ?? []) as Array<{
    account_id: string;
    entitlement_key: string;
    expires_at: string | null;
  }>) {
    if (row.expires_at && row.expires_at <= now) {
      continue;
    }

    const tier = entitlementKeyToTier(row.entitlement_key);
    if (!tier) {
      continue;
    }

    const existing = tierByAccount.get(row.account_id);
    if (!existing || tierRank(tier) > tierRank(existing)) {
      tierByAccount.set(row.account_id, tier);
    }
  }

  const tierByUser = new Map<string, string>();

  for (const row of (memberships ?? []) as Array<{
    user_id: string;
    account_role: string | null;
    account_id: string;
  }>) {
    if (row.account_role !== 'admin' && row.account_role !== 'owner') {
      continue;
    }

    const accountTier = tierByAccount.get(row.account_id);
    if (!accountTier) {
      continue;
    }

    const existing = tierByUser.get(row.user_id);
    if (!existing || tierRank(accountTier) > tierRank(existing)) {
      tierByUser.set(row.user_id, accountTier);
    }
  }

  return { tierByUser, businessOwnerIds };
}

function entitlementKeyToTier(key: string) {
  switch (key) {
    case 'workspace_community':
      return 'tier_1';
    case 'workspace_business':
      return 'tier_2';
    case 'workspace_property':
      return 'tier_3';
    default:
      return '';
  }
}

function tierRank(tier: string) {
  if (tier === 'tier_3') return 3;
  if (tier === 'tier_2') return 2;
  if (tier === 'tier_1') return 1;
  return 0;
}

function normalizeTier(value: string) {
  const tier = value.toLowerCase();
  if (tier === 'tier1' || tier === 'tier_1' || tier === 'workspace_community') {
    return 'tier_1';
  }
  if (tier === 'tier2' || tier === 'tier_2' || tier === 'workspace_business') {
    return 'tier_2';
  }
  if (tier === 'tier3' || tier === 'tier_3' || tier === 'workspace_property') {
    return 'tier_3';
  }
  return '';
}

export async function resolveCampaignRecipients(
  campaign: Pick<
    EmailCampaignRow,
    | 'recipient_list'
    | 'contact_list_id'
    | 'manual_recipient_emails'
    | 'custom_recipient_ids'
  >,
) {
  const admin = getAdminClient();
  const unsubscribed = await getUnsubscribedEmails(admin);
  let recipients: CampaignRecipient[] = [];

  if (campaign.recipient_list === 'pre_signup_contacts') {
    const users = await listAuthUsers(admin);
    const signedUpEmails = new Set(
      users
        .map((user) => user.email?.trim())
        .filter((email): email is string => Boolean(email))
        .map(normalizeEmail),
    );
    const exclusions = await loadSystemListExclusions(
      admin,
      'pre_signup_contacts',
    );

    const { data, error } = await admin
      .from('email_contacts')
      .select('id, email, first_name')
      .eq('subscribed', true);

    if (error) {
      throw new Error(error.message);
    }

    recipients = (
      (data ?? []) as Array<{
        id: string;
        email: string;
        first_name?: string | null;
      }>
    )
      .filter(
        (contact) =>
          !signedUpEmails.has(normalizeEmail(contact.email)) &&
          !exclusions.has(contact.id),
      )
      .map((contact) => ({
        email: contact.email,
        firstName: contact.first_name,
        contactId: contact.id,
      }));
  } else if (campaign.recipient_list === 'beta_contacts') {
    const exclusions = await loadSystemListExclusions(admin, 'beta_contacts');

    const { data, error } = await admin
      .from('email_contacts')
      .select('id, email, first_name')
      .eq('subscribed', true)
      .eq('source', 'beta');

    if (error) {
      throw new Error(error.message);
    }

    recipients = (
      (data ?? []) as Array<{
        id: string;
        email: string;
        first_name?: string | null;
      }>
    )
      .filter((contact) => !exclusions.has(contact.id))
      .map((contact) => ({
        email: contact.email,
        firstName: contact.first_name,
        contactId: contact.id,
      }));
  } else if (campaign.recipient_list === 'contact_list') {
    if (!campaign.contact_list_id) {
      throw new Error('Custom contact list is not selected');
    }

    const { data, error } = await admin
      .from('email_contact_list_members')
      .select(
        `
        contact_id,
        email_contacts (
          id,
          email,
          first_name,
          subscribed
        )
      `,
      )
      .eq('list_id', campaign.contact_list_id);

    if (error) {
      throw new Error(error.message);
    }

    recipients = (
      (data ?? []) as Array<{
        contact_id: string;
        email_contacts: {
          id: string;
          email: string;
          first_name?: string | null;
          subscribed?: boolean | null;
        } | null;
      }>
    )
      .map((row) => row.email_contacts)
      .filter(
        (contact) =>
          contact != null &&
          Boolean(contact.email) &&
          contact.subscribed !== false,
      )
      .map((contact) => ({
        email: contact!.email,
        firstName: contact!.first_name,
        contactId: contact!.id,
      }));
  } else if (campaign.recipient_list === 'manual') {
    recipients = parseManualEmails(campaign.manual_recipient_emails).map(
      (email) => ({ email }),
    );
  } else {
    const users = await listAuthUsers(admin);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const { tierByUser, businessOwnerIds } = await resolveTierUserIds(admin);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const selected = users.filter((user) => {
      const tier = tierByUser.get(user.id);

      switch (campaign.recipient_list) {
        case 'all_users':
          return true;
        case 'tier_1':
        case 'tier_2':
        case 'tier_3':
          return tier === campaign.recipient_list;
        case 'business_owners':
          return businessOwnerIds.has(user.id);
        case 'beta_users':
          return Boolean(
            user.created_at && new Date(user.created_at) < BETA_CUTOFF,
          );
        case 'inactive':
          return (
            !user.last_sign_in_at ||
            new Date(user.last_sign_in_at).getTime() < thirtyDaysAgo
          );
        case 'no_subscription':
          return !tierByUser.has(user.id);
        case 'custom':
          return (campaign.custom_recipient_ids ?? []).includes(user.id);
        default:
          return false;
      }
    });

    recipients = selected.map((user) => ({
      email: user.email ?? '',
      firstName: firstNameFromAuthUser(user),
      recipientId: user.id,
    }));
  }

  return uniqueRecipients(recipients).filter(
    (recipient) => !unsubscribed.has(normalizeEmail(recipient.email)),
  );
}

function filterRecipientListMembers(
  members: RecipientListMember[],
  query?: string,
) {
  const needle = query?.trim().toLowerCase();
  if (!needle) return members;

  return members.filter((member) => {
    const haystack = [member.email, member.name ?? '', member.trade ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

type ExcludableSystemListKey = 'pre_signup_contacts' | 'beta_contacts';

async function loadSystemListExclusions(
  admin: ReturnType<typeof getAdminClient>,
  listKey: ExcludableSystemListKey,
) {
  const { data, error } = await admin
    .from('email_contact_list_exclusions')
    .select('contact_id')
    .eq('list_key', listKey);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    ((data ?? []) as Array<{ contact_id: string }>).map(
      (row) => row.contact_id,
    ),
  );
}

async function loadAllSystemListExclusions(
  admin: ReturnType<typeof getAdminClient>,
) {
  const { data, error } = await admin
    .from('email_contact_list_exclusions')
    .select('contact_id, list_key');

  if (error) {
    throw new Error(error.message);
  }

  const byList: Record<ExcludableSystemListKey, Set<string>> = {
    pre_signup_contacts: new Set(),
    beta_contacts: new Set(),
  };

  for (const row of (data ?? []) as Array<{
    contact_id: string;
    list_key: string;
  }>) {
    if (
      row.list_key === 'pre_signup_contacts' ||
      row.list_key === 'beta_contacts'
    ) {
      byList[row.list_key].add(row.contact_id);
    }
  }

  return byList;
}

export async function loadCustomContactLists(): Promise<
  CustomContactListRow[]
> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('email_contact_lists')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CustomContactListRow[];
}

async function loadCustomListMembership(
  admin: ReturnType<typeof getAdminClient>,
  customLists: CustomContactListRow[],
  unsubscribed: Set<string>,
) {
  const membership = new Map<string, RecipientListMember[]>();
  for (const list of customLists) {
    membership.set(customListKey(list.id), []);
  }

  if (customLists.length === 0) {
    return membership;
  }

  const listIds = customLists.map((list) => list.id);
  const { data, error } = await admin
    .from('email_contact_list_members')
    .select(
      `
      list_id,
      email_contacts (
        id,
        email,
        first_name,
        last_name,
        trade,
        subscribed
      )
    `,
    )
    .in('list_id', listIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as Array<{
    list_id: string;
    email_contacts: {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      trade: string | null;
      subscribed: boolean | null;
    } | null;
  }>) {
    const contact = row.email_contacts;
    if (!contact?.email || contact.subscribed === false) continue;
    if (unsubscribed.has(normalizeEmail(contact.email))) continue;

    const key = customListKey(row.list_id);
    const members = membership.get(key);
    if (!members) continue;

    members.push({
      email: contact.email,
      name: `${contact.first_name} ${contact.last_name}`.trim() || null,
      kind: 'contact',
      contactId: contact.id,
      trade: contact.trade,
    });
  }

  return membership;
}

export async function buildRecipientListMembership() {
  const admin = getAdminClient();
  const unsubscribed = await getUnsubscribedEmails(admin);
  const users = await listAuthUsers(admin);
  const { tierByUser, businessOwnerIds } = await resolveTierUserIds(admin);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const exclusions = await loadAllSystemListExclusions(admin);
  const customLists = await loadCustomContactLists();
  const customMembership = await loadCustomListMembership(
    admin,
    customLists,
    unsubscribed,
  );

  const membership = Object.fromEntries(
    EMAIL_RECIPIENT_LISTS.map((list) => [list, [] as RecipientListMember[]]),
  ) as Record<EmailRecipientList, RecipientListMember[]>;

  const customMembershipRecord = Object.fromEntries(customMembership) as Record<
    string,
    RecipientListMember[]
  >;

  for (const user of users) {
    const email = user.email?.trim();
    if (!email) continue;

    const normalized = normalizeEmail(email);
    if (unsubscribed.has(normalized)) continue;

    const tier = tierByUser.get(user.id) ?? null;
    const member: RecipientListMember = {
      email,
      name: null,
      kind: 'user',
      userId: user.id,
      tier,
      lastSignInAt: user.last_sign_in_at ?? null,
    };

    membership.all_users.push(member);

    if (tier === 'tier_1') membership.tier_1.push(member);
    if (tier === 'tier_2') membership.tier_2.push(member);
    if (tier === 'tier_3') membership.tier_3.push(member);
    if (businessOwnerIds.has(user.id)) membership.business_owners.push(member);
    if (user.created_at && new Date(user.created_at) < BETA_CUTOFF) {
      membership.beta_users.push(member);
    }
    if (
      !user.last_sign_in_at ||
      new Date(user.last_sign_in_at).getTime() < thirtyDaysAgo
    ) {
      membership.inactive.push(member);
    }
    if (!tierByUser.has(user.id)) {
      membership.no_subscription.push(member);
    }
  }

  const { data: contacts, error } = await admin
    .from('email_contacts')
    .select('id, email, first_name, last_name, trade, subscribed, source')
    .eq('subscribed', true);

  if (error) {
    throw new Error(error.message);
  }

  const signedUpEmails = new Set(
    users
      .map((user) => user.email?.trim())
      .filter((email): email is string => Boolean(email))
      .map(normalizeEmail),
  );

  for (const contact of (contacts ?? []) as Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    trade: string | null;
    source: string | null;
  }>) {
    const normalized = normalizeEmail(contact.email);
    if (unsubscribed.has(normalized)) continue;

    const member: RecipientListMember = {
      email: contact.email,
      name: `${contact.first_name} ${contact.last_name}`.trim() || null,
      kind: 'contact',
      contactId: contact.id,
      trade: contact.trade,
    };

    if (!signedUpEmails.has(normalized)) {
      if (!exclusions.pre_signup_contacts.has(contact.id)) {
        membership.pre_signup_contacts.push(member);
      }
    }

    if (
      contact.source === 'beta' &&
      !exclusions.beta_contacts.has(contact.id)
    ) {
      membership.beta_contacts.push(member);
    }
  }

  return {
    system: membership,
    custom: customMembershipRecord,
    customLists,
  };
}

export async function loadRecipientListsOverview(params?: {
  list?: string;
  query?: string;
}) {
  const built = await buildRecipientListMembership();
  const { system: membership, custom: customMembership, customLists } = built;

  const summaries: RecipientListSummary[] = [
    ...EMAIL_RECIPIENT_LISTS.map((list) => ({
      list,
      label: RECIPIENT_LIST_LABELS[list],
      description: RECIPIENT_LIST_DESCRIPTIONS[list],
      count: membership[list].length,
      campaignSpecific:
        list === 'manual' || list === 'custom' || list === 'contact_list',
      editable: list === 'pre_signup_contacts' || list === 'beta_contacts',
    })),
    ...customLists.map((customList) => {
      const listKey = customListKey(customList.id);
      return {
        list: listKey,
        label: customList.name,
        description:
          customList.description?.trim() ||
          'Custom contact list — add members explicitly.',
        count: customMembership[listKey]?.length ?? 0,
        campaignSpecific: false,
        editable: true,
        deletable: true,
        customListId: customList.id,
      };
    }),
  ];

  const selectedList =
    params?.list && summaries.some((summary) => summary.list === params.list)
      ? params.list
      : 'all_users';

  const members =
    selectedList in membership
      ? membership[selectedList as EmailRecipientList]
      : (customMembership[selectedList] ?? []);

  return {
    summaries,
    selectedList,
    members: filterRecipientListMembers(members, params?.query),
  };
}

export async function estimateCampaignRecipients(
  params: Pick<
    EmailCampaignRow,
    | 'recipient_list'
    | 'contact_list_id'
    | 'manual_recipient_emails'
    | 'custom_recipient_ids'
  >,
) {
  const recipients = await resolveCampaignRecipients(params);
  return recipients.length;
}

function rewriteCampaignTrackingLinks(params: {
  html: string;
  campaignId: string;
  metricId: string;
}) {
  const baseUrl = getAppBaseUrl();

  return params.html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match, url: string) => {
      if (
        url.includes('/unsubscribe?') ||
        url.includes('/api/track/click') ||
        url.includes('/api/track/open') ||
        url.includes('/email/campaign/view')
      ) {
        return `href="${url}"`;
      }

      const trackingUrl = `${baseUrl}/api/track/click?cid=${params.campaignId}&rid=${params.metricId}&url=${encodeURIComponent(url)}`;
      return `href="${trackingUrl}"`;
    },
  );
}

function buildCampaignTrackingPixel(params: {
  campaignId: string;
  metricId: string;
}) {
  const baseUrl = getAppBaseUrl();
  return `<img src="${baseUrl}/api/track/open?cid=${params.campaignId}&rid=${params.metricId}" alt="" width="1" height="1" style="display:none!important;width:1px;height:1px;border:0;" />`;
}

function buildRecipientHtml(params: {
  html: string;
  campaignId: string;
  metricId: string;
  email: string;
  firstName?: string | null;
  viewUrl?: string;
  includeViewBanner?: boolean;
}) {
  const unsubscribeUrl = buildUnsubscribeUrl(params.email);
  const footer = `<p style="margin:0;color:#667085;font-size:12px;line-height:1.6;">If you no longer want to receive these emails, <a href="${unsubscribeUrl}" style="color:#1A3A2E;text-decoration:underline;">unsubscribe here</a>.</p>`;
  const banner =
    params.viewUrl && params.includeViewBanner !== false
      ? renderViewInBrowserBanner(params.viewUrl)
      : undefined;
  const trackingPixel = buildCampaignTrackingPixel({
    campaignId: params.campaignId,
    metricId: params.metricId,
  });

  let html = personalizeCampaignMergeTags(params.html, {
    firstName: params.firstName,
    email: params.email,
  });
  html = prepareCampaignHtmlForDelivery(html);
  html = wrapCampaignHtmlForEmailClients(html, {
    bannerHtml: banner,
    footerHtml: footer,
    trackingPixelHtml: trackingPixel,
  });

  return rewriteCampaignTrackingLinks({
    html,
    campaignId: params.campaignId,
    metricId: params.metricId,
  });
}

async function sendCampaignEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  campaignId: string;
  listUnsubscribeUrl?: string;
}) {
  const result = await sendTransactionalEmail({
    to: params.to,
    subject: params.subject,
    htmlBody: params.html,
    textBody: params.text,
    clientReference: params.campaignId,
    listUnsubscribeUrl: params.listUnsubscribeUrl,
  });

  if (!result.sent) {
    throw new Error(
      `${params.to} is on the email suppression list (bounce or complaint). Remove it in Supabase email_suppressions before retrying.`,
    );
  }

  return getTransactionalEmailSender();
}

export async function sendCampaign(campaignId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const campaign = data as EmailCampaignRow | null;
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status !== 'draft') {
    throw new Error('Only draft campaigns can be sent');
  }

  const recipients = await resolveCampaignRecipients(campaign);

  await admin
    .from('email_campaigns')
    .update({
      status: 'sending',
      total_recipients: recipients.length,
      sent_count: 0,
    })
    .eq('id', campaignId);

  let sentCount = 0;

  for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
    const batch = recipients.slice(index, index + BATCH_SIZE);

    await Promise.all(
      batch.map(async (recipient) => {
        const { data: metric, error: metricError } = await admin
          .from('email_campaign_metrics')
          .upsert(
            {
              campaign_id: campaign.id,
              recipient_id: recipient.recipientId ?? null,
              contact_id: recipient.contactId ?? null,
              email: recipient.email,
            },
            { onConflict: 'campaign_id,email' },
          )
          .select('id')
          .single();

        if (metricError) {
          throw new Error(metricError.message);
        }

        const metricId = (metric as { id: string }).id;
        const viewUrl = buildCampaignViewUrl({
          campaignId: campaign.id,
          metricId,
          email: recipient.email,
        });
        const unsubscribeUrl = buildUnsubscribeUrl(recipient.email);
        const html = buildRecipientHtml({
          html: campaign.html_body,
          campaignId: campaign.id,
          metricId,
          email: recipient.email,
          firstName: recipient.firstName,
          viewUrl,
        });
        const text = buildCampaignPlainTextBody({
          previewText: campaign.preview_text,
          html: campaign.html_body,
          viewUrl,
          unsubscribeUrl,
          plainTextOverride: campaign.plain_text_body,
        });

        let status: 'sent' | 'failed' = 'sent';
        let errorMessage: string | null = null;
        let from: string | null = null;

        try {
          from = await sendCampaignEmail({
            to: recipient.email,
            subject: campaign.subject,
            html,
            text,
            campaignId: campaign.id,
            listUnsubscribeUrl: unsubscribeUrl,
          });

          await admin
            .from('email_campaign_metrics')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', metricId);
        } catch (error) {
          status = 'failed';
          errorMessage = error instanceof Error ? error.message : String(error);
          throw error;
        } finally {
          await insertPlatformEmailLog({
            emailType: 'campaign',
            accountId: null,
            recipientEmail: recipient.email,
            senderEmail: from,
            subject: campaign.subject,
            status,
            errorMessage,
            metadata: {
              campaign_id: campaign.id,
              metric_id: metricId,
              campaign_title: campaign.title,
              recipient_list: campaign.recipient_list,
            },
          });
        }
      }),
    );

    sentCount += batch.length;
    await admin
      .from('email_campaigns')
      .update({ sent_count: sentCount })
      .eq('id', campaign.id);

    if (index + BATCH_SIZE < recipients.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  await admin
    .from('email_campaigns')
    .update({
      status: 'sent',
      sent_count: sentCount,
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  return {
    total: recipients.length,
    sent: sentCount,
  };
}

export async function sendTestCampaignEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  prefix?: 'Test' | 'Copy';
}) {
  const label = params.prefix ?? 'Test';
  const subject = `[${label}] ${params.subject}`;
  const html = prepareCampaignHtmlForDelivery(params.html);

  const from = await sendCampaignEmail({
    to: params.to,
    subject,
    html,
    text: params.text?.trim() || htmlToPlainText(html),
    campaignId: 'test',
  });

  await insertPlatformEmailLog({
    emailType: 'campaign',
    recipientEmail: params.to,
    senderEmail: from,
    subject,
    status: 'sent',
    metadata: { test: true, copy: label === 'Copy' },
  });
}

export async function getCampaignProgress(campaignId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('email_campaigns')
    .select('id, status, total_recipients, sent_count, sent_at')
    .eq('id', campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Pick<
    EmailCampaignRow,
    'id' | 'status' | 'total_recipients' | 'sent_count' | 'sent_at'
  > | null;
}

export async function loadCampaignViewHtml(params: {
  campaignId: string;
  metricId: string;
  signature: string;
}) {
  const admin = getAdminClient();

  const { data: metric, error: metricError } = await admin
    .from('email_campaign_metrics')
    .select('id, campaign_id, email, sent_at')
    .eq('id', params.metricId)
    .eq('campaign_id', params.campaignId)
    .maybeSingle();

  if (metricError || !metric) {
    return null;
  }

  const email = normalizeEmail((metric as { email: string }).email);

  if (
    !verifyCampaignViewToken({
      campaignId: params.campaignId,
      metricId: params.metricId,
      email,
      signature: params.signature,
    })
  ) {
    return null;
  }

  const { data: campaign, error: campaignError } = await admin
    .from('email_campaigns')
    .select('html_body, status')
    .eq('id', params.campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return null;
  }

  const status = (campaign as { status: string }).status;
  if (!['sending', 'sent'].includes(status)) {
    return null;
  }

  await markOpen(params.metricId);

  return buildRecipientHtml({
    html: (campaign as { html_body: string }).html_body,
    campaignId: params.campaignId,
    metricId: params.metricId,
    email,
    viewUrl: buildCampaignViewUrl({
      campaignId: params.campaignId,
      metricId: params.metricId,
      email,
    }),
    includeViewBanner: false,
  });
}

export async function markOpen(metricId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('email_campaign_metrics')
    .select('open_count, opened_at')
    .eq('id', metricId)
    .maybeSingle();

  if (error || !data) {
    return;
  }

  await admin
    .from('email_campaign_metrics')
    .update({
      opened_at:
        (data as { opened_at: string | null }).opened_at ??
        new Date().toISOString(),
      open_count: ((data as { open_count: number | null }).open_count ?? 0) + 1,
    })
    .eq('id', metricId);
}

export async function markClick(metricId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('email_campaign_metrics')
    .select('click_count, clicked_at')
    .eq('id', metricId)
    .maybeSingle();

  if (error || !data) {
    return;
  }

  await admin
    .from('email_campaign_metrics')
    .update({
      clicked_at:
        (data as { clicked_at: string | null }).clicked_at ??
        new Date().toISOString(),
      click_count:
        ((data as { click_count: number | null }).click_count ?? 0) + 1,
    })
    .eq('id', metricId);
}

export async function unsubscribeEmail(
  email: string,
  reason = 'unsubscribe_page',
) {
  const admin = getAdminClient();
  const normalized = normalizeEmail(email);

  const [{ data: users }, { data: contacts }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from('email_contacts')
      .select('id, email')
      .eq('email', normalized)
      .maybeSingle(),
  ]);

  const user = users.users.find(
    (candidate) => normalizeEmail(candidate.email ?? '') === normalized,
  );
  const contact = contacts as { id: string } | null;

  const { error } = await admin.from('email_unsubscribes').upsert(
    {
      email: normalized,
      user_id: user?.id ?? null,
      contact_id: contact?.id ?? null,
      reason,
      unsubscribed_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  );

  if (error) {
    throw new Error(error.message);
  }
}
