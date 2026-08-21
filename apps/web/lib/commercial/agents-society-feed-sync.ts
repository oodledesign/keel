import 'server-only';

import { randomUUID } from 'crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const DEFAULT_AS_FEED_URL =
  'https://s3-eu-west-1.amazonaws.com/feeds.agents-society.com/828-ai-feed-1526805793.xml';

export type AgentsSocietyFeedContact = {
  name: string | null;
  email: string | null;
  branch: string | null;
  office: string | null;
};

export type AgentsSocietyFeedProperty = {
  externalId: string;
  contacts: AgentsSocietyFeedContact[];
  /** First non-empty branch across contacts. */
  branch: string | null;
};

export type SyncAgentsSocietyFeedResult = {
  feedUrl: string;
  propertiesInFeed: number;
  matchedListings: number;
  branchesAssigned: number;
  agentsAssigned: number;
  pendingAgentsStored: number;
  silentInvitesCreated: number;
  silentInviteEmails: string[];
  unmatchedExternalIds: number;
  unknownBranches: string[];
};

function field(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  const value = match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  return value || null;
}

export function parseAgentsSocietyFeedXml(
  xml: string,
): AgentsSocietyFeedProperty[] {
  const properties: AgentsSocietyFeedProperty[] = [];
  const propertyRe = /<property\b[^>]*>([\s\S]*?)<\/property>/gi;
  let propertyMatch: RegExpExecArray | null;

  while ((propertyMatch = propertyRe.exec(xml))) {
    const block = propertyMatch[1] ?? '';
    const externalId = field(block, 'id') || field(block, 'object_id') || null;
    if (!externalId) continue;

    const contacts: AgentsSocietyFeedContact[] = [];
    const contactRe = /<contact\b[^>]*>([\s\S]*?)<\/contact>/gi;
    let contactMatch: RegExpExecArray | null;
    while ((contactMatch = contactRe.exec(block))) {
      const inner = contactMatch[1] ?? '';
      contacts.push({
        name: field(inner, 'name'),
        email: field(inner, 'email')?.toLowerCase() ?? null,
        branch: field(inner, 'branch'),
        office: field(inner, 'office'),
      });
    }

    const branch = contacts.map((c) => c.branch?.trim()).find(Boolean) ?? null;

    properties.push({
      externalId,
      contacts,
      branch,
    });
  }

  return properties;
}

async function fetchAgentsSocietyFeed(
  feedUrl: string,
): Promise<AgentsSocietyFeedProperty[]> {
  const response = await fetch(feedUrl, {
    headers: { Accept: 'application/xml,text/xml,*/*' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Agents Society feed fetch failed (${response.status})`);
  }
  const xml = await response.text();
  return parseAgentsSocietyFeedXml(xml);
}

/**
 * Match AS feed → disposals: set office/branch, acting agents for members,
 * pending emails + silent workspace invites for non-members.
 */
export async function syncAgentsSocietyFeedToAccount(input: {
  accountId: string;
  accountSlug: string;
  feedUrl?: string;
  /** User who appears as invited_by on silent invites. */
  invitedByUserId: string;
  /** Create invitation rows without sending email. Default true. */
  createSilentInvites?: boolean;
}): Promise<SyncAgentsSocietyFeedResult> {
  const feedUrl = input.feedUrl?.trim() || DEFAULT_AS_FEED_URL;
  const createSilentInvites = input.createSilentInvites !== false;
  const admin = getSupabaseServerAdminClient();

  const properties = await fetchAgentsSocietyFeed(feedUrl);
  const byExternalId = new Map(
    properties.map((p) => [p.externalId, p] as const),
  );

  const { data: branches, error: branchError } = await admin
    .from('account_branches')
    .select('id, name')
    .eq('account_id', input.accountId);

  if (branchError) throw new Error(branchError.message);

  const branchByName = new Map(
    ((branches ?? []) as Array<{ id: string; name: string }>).map((b) => [
      b.name.trim().toLowerCase(),
      b.id,
    ]),
  );

  const { data: listings, error: listingError } = await admin
    .from('commercial_listings')
    .select('id, external_id, account_branch_id')
    .eq('account_id', input.accountId)
    .not('external_id', 'is', null);

  if (listingError) throw new Error(listingError.message);

  const { data: memberships, error: memberError } = await admin
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', input.accountId);

  if (memberError) throw new Error(memberError.message);

  const memberUserIds = (memberships ?? []).map(
    (m) => (m as { user_id: string }).user_id,
  );

  const emailByUserId = new Map<string, string>();
  for (const userId of memberUserIds) {
    const { data, error: userError } =
      await admin.auth.admin.getUserById(userId);
    if (userError) {
      console.warn(
        '[agents-society-feed] getUserById failed:',
        userId,
        userError.message,
      );
      continue;
    }
    const email = data.user?.email?.trim().toLowerCase();
    if (email) emailByUserId.set(userId, email);
  }

  const userIdByEmail = new Map(
    [...emailByUserId.entries()].map(([id, email]) => [email, id]),
  );

  const { data: existingInvites } = await admin
    .from('invitations')
    .select('email')
    .eq('account_id', input.accountId);

  const invitedEmails = new Set(
    ((existingInvites ?? []) as Array<{ email: string }>).map((i) =>
      i.email.trim().toLowerCase(),
    ),
  );

  let matchedListings = 0;
  let branchesAssigned = 0;
  let agentsAssigned = 0;
  let pendingAgentsStored = 0;
  let unmatchedExternalIds = 0;
  const unknownBranches = new Set<string>();
  const emailsNeedingInvite = new Set<string>();

  for (const listing of (listings ?? []) as Array<{
    id: string;
    external_id: string | null;
    account_branch_id: string | null;
  }>) {
    const externalId = listing.external_id?.trim();
    if (!externalId) continue;
    const property = byExternalId.get(externalId);
    if (!property) {
      unmatchedExternalIds += 1;
      continue;
    }
    matchedListings += 1;

    if (property.branch) {
      const branchId = branchByName.get(property.branch.trim().toLowerCase());
      if (branchId) {
        // System sync — do not bump updated_at (cards / "Updated last" sort).
        if (listing.account_branch_id !== branchId) {
          const { error } = await admin
            .from('commercial_listings')
            .update({ account_branch_id: branchId })
            .eq('id', listing.id)
            .eq('account_id', input.accountId);
          if (error) throw new Error(error.message);
          listing.account_branch_id = branchId;
          branchesAssigned += 1;
        }
      } else {
        unknownBranches.add(property.branch.trim());
      }
    }

    const seenEmails = new Set<string>();
    let sortOrder = 0;
    for (const contact of property.contacts) {
      const email = contact.email?.trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      const userId = userIdByEmail.get(email);
      if (userId) {
        const { error } = await admin.from('commercial_listing_agents').upsert(
          {
            listing_id: listing.id,
            account_id: input.accountId,
            user_id: userId,
            sort_order: sortOrder,
          },
          { onConflict: 'listing_id,user_id' },
        );
        if (error) throw new Error(error.message);
        agentsAssigned += 1;
      } else {
        const { data: existing } = await admin
          .from('commercial_listing_pending_agents')
          .select('id')
          .eq('listing_id', listing.id)
          .eq('account_id', input.accountId)
          .ilike('email', email)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await admin
            .from('commercial_listing_pending_agents')
            .update({ sort_order: sortOrder })
            .eq('id', (existing as { id: string }).id);
          if (updateError) throw new Error(updateError.message);
        } else {
          const { error: insertError } = await admin
            .from('commercial_listing_pending_agents')
            .insert({
              listing_id: listing.id,
              account_id: input.accountId,
              email,
              sort_order: sortOrder,
            });
          if (insertError) throw new Error(insertError.message);
        }
        pendingAgentsStored += 1;
        if (!invitedEmails.has(email)) {
          emailsNeedingInvite.add(email);
        }
      }
      sortOrder += 1;
    }
  }

  const silentInviteEmails: string[] = [];
  if (createSilentInvites) {
    for (const email of emailsNeedingInvite) {
      const token = randomUUID();
      const { error } = await admin.from('invitations').insert({
        email,
        account_id: input.accountId,
        invited_by: input.invitedByUserId,
        role: 'staff',
        invite_token: token,
        seat_kind: 'billable',
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      if (error) {
        // Unique (email, account_id) — already invited
        if (!/duplicate|unique/i.test(error.message)) {
          throw new Error(error.message);
        }
        continue;
      }
      silentInviteEmails.push(email);
      invitedEmails.add(email);
    }
  }

  return {
    feedUrl,
    propertiesInFeed: properties.length,
    matchedListings,
    branchesAssigned,
    agentsAssigned,
    pendingAgentsStored,
    silentInvitesCreated: silentInviteEmails.length,
    silentInviteEmails,
    unmatchedExternalIds,
    unknownBranches: [...unknownBranches].sort(),
  };
}

export { DEFAULT_AS_FEED_URL };
