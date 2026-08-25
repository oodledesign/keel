import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildCirculationEmailHtml,
  createCirculationUnsubscribeToken,
  createCommercialCirculationService,
  sendCirculationEmailViaSes,
} from '~/lib/commercial/circulation/circulation.service';
import {
  type MatchListingSnapshot,
  type MatchRequirementSnapshot,
  scoreListingRequirementMatch,
} from '~/lib/commercial/match-scoring';

export type CirculationCandidate = {
  requirementId: string;
  email: string;
  contactName: string | null;
  companyName: string | null;
  score: number;
  reasons: string[];
  subscribed: boolean;
};

function asListingSnapshot(row: Record<string, unknown>): MatchListingSnapshot {
  return {
    id: row.id as string,
    name: (row.name as string) ?? 'Property',
    sector: (row.sector as string | null) ?? null,
    disposalType:
      (row.disposal_type as MatchListingSnapshot['disposalType']) ?? 'to_let',
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    addressLine1: (row.address_line_1 as string | null) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    sizeMinSqft: row.size_min_sqft != null ? Number(row.size_min_sqft) : null,
    sizeMaxSqft: row.size_max_sqft != null ? Number(row.size_max_sqft) : null,
    askingRentPence:
      row.asking_rent_pence != null ? Number(row.asking_rent_pence) : null,
    askingRentToPence:
      row.asking_rent_to_pence != null
        ? Number(row.asking_rent_to_pence)
        : null,
    askingPricePence:
      row.asking_price_pence != null ? Number(row.asking_price_pence) : null,
    status: (row.status as string) ?? 'draft',
  };
}

function asRequirementSnapshot(
  row: Record<string, unknown>,
): MatchRequirementSnapshot {
  return {
    id: row.id as string,
    companyName: (row.company_name as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    sector: (row.sector as string | null) ?? null,
    tenure: (row.tenure as MatchRequirementSnapshot['tenure']) ?? null,
    locationText: (row.location_text as string | null) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    searchRadiusMiles:
      row.search_radius_miles != null ? Number(row.search_radius_miles) : null,
    sizeMinSqft: row.size_min_sqft != null ? Number(row.size_min_sqft) : null,
    sizeMaxSqft: row.size_max_sqft != null ? Number(row.size_max_sqft) : null,
    budgetMinPence:
      row.budget_min_pence != null ? Number(row.budget_min_pence) : null,
    budgetMaxPence:
      row.budget_max_pence != null ? Number(row.budget_max_pence) : null,
    notes: (row.notes as string | null) ?? null,
    stage: (row.stage as string) ?? 'new',
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function listCirculationCandidates(
  client: SupabaseClient,
  input: { accountId: string; listingId: string; minScore?: number },
): Promise<CirculationCandidate[]> {
  const minScore = input.minScore ?? 35;

  const { data: listing, error: listingError } = await client
    .from('commercial_listings')
    .select(
      'id, name, sector, disposal_type, town, postcode, address_line_1, latitude, longitude, size_min_sqft, size_max_sqft, asking_rent_pence, asking_rent_to_pence, asking_price_pence, status, summary, description, account_id',
    )
    .eq('id', input.listingId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (listingError || !listing) {
    throw new Error(listingError?.message ?? 'Listing not found');
  }

  const { data: requirements, error: reqError } = await client
    .from('commercial_requirements')
    .select('*')
    .eq('account_id', input.accountId)
    .not('contact_email', 'is', null)
    .in('stage', [
      'new',
      'actively_searching',
      'search',
      'prospect',
      'unactioned',
    ]);

  if (reqError) throw new Error(reqError.message);

  const listingSnap = asListingSnapshot(listing as Record<string, unknown>);
  const circulation = createCommercialCirculationService(client);
  const rows = (requirements ?? []) as Array<Record<string, unknown>>;
  const emails = rows
    .map((row) =>
      String(row.contact_email ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  const subscribedSet = await circulation.getSubscribedEmails(
    input.accountId,
    emails,
  );
  const candidates: CirculationCandidate[] = [];

  for (const row of rows) {
    const email = String(row.contact_email ?? '')
      .trim()
      .toLowerCase();
    if (!email) continue;

    const score = scoreListingRequirementMatch(
      listingSnap,
      asRequirementSnapshot(row),
    );
    if (score.score < minScore) continue;

    candidates.push({
      requirementId: row.id as string,
      email,
      contactName: (row.contact_name as string | null) ?? null,
      companyName: (row.company_name as string | null) ?? null,
      score: score.score,
      reasons: score.reasons,
      subscribed: subscribedSet.has(email),
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export async function circulateListing(
  client: SupabaseClient,
  input: {
    accountId: string;
    listingId: string;
    requirementIds: string[];
    sentBy: string;
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
    siteUrl: string;
  },
): Promise<{ sendId: string; sent: number; skipped: number; failed: number }> {
  if (input.requirementIds.length === 0) {
    throw new Error('Select at least one recipient');
  }
  if (input.requirementIds.length > 200) {
    throw new Error('Too many recipients (max 200 per send)');
  }

  const { data: listing, error: listingError } = await client
    .from('commercial_listings')
    .select(
      'id, name, summary, description, address_line_1, address_line_2, town, county, postcode, account_id, brochure_share_token, brochure_share_enabled',
    )
    .eq('id', input.listingId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (listingError || !listing) {
    throw new Error(listingError?.message ?? 'Listing not found');
  }

  const { data: account } = await client
    .from('accounts')
    .select('name')
    .eq('id', input.accountId)
    .maybeSingle();

  const agencyName =
    (account as { name?: string | null } | null)?.name?.trim() || 'Agency';

  const { data: requirements, error: reqError } = await client
    .from('commercial_requirements')
    .select('id, contact_email, contact_name, company_name')
    .eq('account_id', input.accountId)
    .in('id', input.requirementIds);

  if (reqError) throw new Error(reqError.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const subject = `Matching opportunity: ${(listing as { name: string }).name}`;

  const { data: sendRow, error: sendError } = await db
    .from('commercial_circulation_sends')
    .insert({
      account_id: input.accountId,
      listing_id: input.listingId,
      sent_by: input.sentBy,
      subject,
      template_version: 'v1',
      recipient_count: 0,
    })
    .select('id')
    .single();

  if (sendError) throw new Error(sendError.message);
  const sendId = sendRow.id as string;

  const circulation = createCommercialCirculationService(client);
  const reqRows = (requirements ?? []) as Array<{
    id: string;
    contact_email?: string | null;
    contact_name?: string | null;
    company_name?: string | null;
  }>;
  const subscribedSet = await circulation.getSubscribedEmails(
    input.accountId,
    reqRows.map((r) => String(r.contact_email ?? '')),
  );

  const listingAddr = [
    (listing as { address_line_1?: string | null }).address_line_1,
    (listing as { address_line_2?: string | null }).address_line_2,
    (listing as { town?: string | null }).town,
    (listing as { county?: string | null }).county,
    (listing as { postcode?: string | null }).postcode,
  ]
    .filter(Boolean)
    .join(', ');

  const summary =
    (listing as { summary?: string | null }).summary?.trim() ||
    (listing as { description?: string | null }).description
      ?.trim()
      ?.slice(0, 600) ||
    '';

  const brochureToken = (listing as { brochure_share_token?: string | null })
    .brochure_share_token;
  const brochureEnabled = Boolean(
    (listing as { brochure_share_enabled?: boolean }).brochure_share_enabled,
  );
  const viewUrl =
    brochureEnabled && brochureToken
      ? new URL(`/share/brochure/${brochureToken}`, input.siteUrl).toString()
      : null;

  const fromHeader = input.fromName
    ? `${input.fromName} <${input.fromEmail}>`
    : input.fromEmail;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const req of reqRows) {
    const email = String(req.contact_email ?? '')
      .trim()
      .toLowerCase();
    const requirementId = req.id;

    if (!email) {
      skipped += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email: 'unknown',
        status: 'skipped',
        skip_reason: 'missing_email',
      });
      continue;
    }

    const subscribed = subscribedSet.has(email);
    if (!subscribed) {
      skipped += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email,
        status: 'skipped',
        skip_reason: 'not_subscribed',
      });
      continue;
    }

    const unsubToken = createCirculationUnsubscribeToken({
      accountId: input.accountId,
      email,
    });
    const unsubscribeUrl = new URL(
      `/unsubscribe/circulation?token=${encodeURIComponent(unsubToken)}`,
      input.siteUrl,
    ).toString();

    try {
      const html = buildCirculationEmailHtml({
        agencyName,
        listingName: (listing as { name: string }).name,
        listingSummary: summary,
        address: listingAddr,
        unsubscribeUrl,
        viewUrl,
      });

      await sendCirculationEmailViaSes({
        to: email,
        from: fromHeader,
        replyTo: input.replyTo,
        subject,
        html,
        listUnsubscribeUrl: unsubscribeUrl,
      });

      sent += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email,
        status: 'sent',
      });

      await client
        .from('commercial_requirements')
        .update({ details_sent: true })
        .eq('id', requirementId)
        .eq('account_id', input.accountId);

      // Upsert interest schedule row
      await db.from('commercial_matches').upsert(
        {
          account_id: input.accountId,
          listing_id: input.listingId,
          requirement_id: requirementId,
          status: 'new',
          notes: 'Created from circulation send',
          created_by: input.sentBy,
        },
        { onConflict: 'listing_id,requirement_id', ignoreDuplicates: true },
      );
    } catch (err) {
      failed += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Send failed',
      });
    }
  }

  await db
    .from('commercial_circulation_sends')
    .update({ recipient_count: sent })
    .eq('id', sendId);

  return { sendId, sent, skipped, failed };
}
