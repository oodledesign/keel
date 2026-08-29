import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type CirculationSendTrigger,
  resolveCirculationIdentity,
} from '~/lib/commercial/circulation/circulate-listing';
import {
  type CirculationEmailBrand,
  buildCirculationDigestEmailHtml,
} from '~/lib/commercial/circulation/circulation-email';
import {
  createCirculationUnsubscribeToken,
  createCommercialCirculationService,
  sendCirculationEmailViaSes,
} from '~/lib/commercial/circulation/circulation.service';
import {
  type ContactMatchRow,
  isContactAutoMailEligible,
  listContactMatches,
} from '~/lib/commercial/circulation/contact-matches';
import {
  matchDigestFingerprint,
  shouldSkipSameDigest,
} from '~/lib/commercial/circulation/digest-fingerprint';

const MAX_CONTACTS_PER_RUN = 80;
const MAX_LISTINGS_PER_EMAIL = 12;

export type DigestMailoutResult = {
  sendId: string | null;
  mailed: number;
  skipped: number;
  failed: number;
  dryRunEligible: number;
  contactsConsidered: number;
};

function toEmailBrand(
  identity: Awaited<ReturnType<typeof resolveCirculationIdentity>>,
): CirculationEmailBrand {
  return {
    agencyName: identity.agencyName,
    logoUrl: identity.brand.logo_url,
    primaryColor: identity.brand.primary_color,
    secondaryColor: identity.brand.secondary_color,
    accentColor: identity.brand.accent_color,
    websiteUrl: identity.brand.website_url,
    address: identity.brand.address,
    phone: identity.brand.phone,
  };
}

function digestSubject(agencyName: string, count: number): string {
  if (count === 1) return `Matching opportunity from ${agencyName}`;
  return `${count} matching opportunities from ${agencyName}`;
}

export async function circulateContactDigests(
  client: SupabaseClient,
  input: {
    accountId: string;
    siteUrl: string;
    sentBy?: string | null;
    dryRun?: boolean;
    sendTrigger?: CirculationSendTrigger;
    /** Restrict to contacts who match this listing; email still lists all their fits. */
    triggerListingId?: string | null;
    /** Auto runs only include contacts who match at least one auto-circulate listing. */
    requireAutoCirculateListing?: boolean;
    /** Auto runs skip unsubscribed / paused / same-set. Manual workspace run uses this too. */
    autoEligibility?: boolean;
  },
): Promise<DigestMailoutResult> {
  const sendTrigger: CirculationSendTrigger = input.dryRun
    ? 'dry_run'
    : (input.sendTrigger ?? 'manual');
  const autoEligibility = input.autoEligibility ?? sendTrigger === 'auto';

  const identity = await resolveCirculationIdentity(client, input.accountId);
  const fromEmail = identity.fromEmail;
  if (!fromEmail) {
    throw new Error(
      'Set a contact email in workspace Brand settings. The address must be on a verified SES domain.',
    );
  }

  const contacts = await listContactMatches(client, {
    accountId: input.accountId,
    siteUrl: input.siteUrl,
    requireListingId: input.triggerListingId ?? undefined,
  });

  const eligible = contacts
    .filter((row) => {
      if (input.requireAutoCirculateListing) {
        return row.listings.some((listing) => listing.autoCirculate);
      }
      return true;
    })
    .filter((row) => (autoEligibility ? isContactAutoMailEligible(row) : true))
    .slice(0, MAX_CONTACTS_PER_RUN);

  if (eligible.length === 0) {
    return {
      sendId: null,
      mailed: 0,
      skipped: contacts.length,
      failed: 0,
      dryRunEligible: 0,
      contactsConsidered: contacts.length,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const listingIds = [
    ...new Set(eligible.flatMap((row) => row.listings.map((l) => l.listingId))),
  ];
  const subject = digestSubject(identity.agencyName, listingIds.length);
  const fromName = identity.fromName;
  const replyTo = identity.replyTo || fromEmail;
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const emailBrand = toEmailBrand(identity);

  const { data: sendRow, error: sendError } = await db
    .from('commercial_circulation_sends')
    .insert({
      account_id: input.accountId,
      listing_id: input.triggerListingId ?? null,
      sent_by: input.sentBy ?? null,
      subject,
      template_version: 'v3-digest',
      recipient_count: 0,
      send_trigger: sendTrigger,
      send_kind: 'digest',
      from_email: fromEmail,
      from_name: fromName,
      reply_to: replyTo,
      listing_ids: listingIds,
      match_fingerprint: matchDigestFingerprint(listingIds),
    })
    .select('id')
    .single();

  if (sendError) throw new Error(sendError.message);
  const sendId = sendRow.id as string;

  const circulation = createCommercialCirculationService(client);
  let mailed = 0;
  let skipped = 0;
  let failed = 0;
  let dryRunEligible = 0;

  for (const contact of eligible) {
    const result = await sendOneDigest({
      client,
      db,
      circulation,
      contact,
      accountId: input.accountId,
      sendId,
      siteUrl: input.siteUrl,
      fromHeader,
      replyTo,
      subject,
      emailBrand,
      dryRun: Boolean(input.dryRun),
      triggerListingId: input.triggerListingId ?? null,
    });
    mailed += result.mailed;
    skipped += result.skipped;
    failed += result.failed;
    dryRunEligible += result.dryRunEligible;
  }

  await db
    .from('commercial_circulation_sends')
    .update({
      recipient_count: input.dryRun ? dryRunEligible : mailed,
    })
    .eq('id', sendId);

  return {
    sendId,
    mailed,
    skipped,
    failed,
    dryRunEligible,
    contactsConsidered: contacts.length,
  };
}

async function sendOneDigest(input: {
  client: SupabaseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  circulation: ReturnType<typeof createCommercialCirculationService>;
  contact: ContactMatchRow;
  accountId: string;
  sendId: string;
  siteUrl: string;
  fromHeader: string;
  replyTo: string;
  subject: string;
  emailBrand: CirculationEmailBrand;
  dryRun: boolean;
  triggerListingId: string | null;
}): Promise<{
  mailed: number;
  skipped: number;
  failed: number;
  dryRunEligible: number;
}> {
  const { contact, accountId, sendId } = input;
  const listings = contact.listings.slice(0, MAX_LISTINGS_PER_EMAIL);
  const fingerprint = matchDigestFingerprint(
    listings.map((listing) => listing.listingId),
  );
  const requirementId = contact.requirementIds[0] ?? null;

  if (
    shouldSkipSameDigest({
      lastFingerprint: contact.lastDigestFingerprint,
      lastSentAt: contact.lastDigestSentAt,
      nextFingerprint: fingerprint,
    })
  ) {
    await input.db.from('commercial_circulation_recipients').insert({
      send_id: sendId,
      account_id: accountId,
      requirement_id: requirementId,
      email: contact.email,
      status: 'skipped',
      skip_reason: 'same_set',
    });
    return { mailed: 0, skipped: 1, failed: 0, dryRunEligible: 0 };
  }

  const unsubToken = createCirculationUnsubscribeToken({
    accountId,
    email: contact.email,
  });
  const unsubscribeUrl = new URL(
    `/unsubscribe/circulation?token=${encodeURIComponent(unsubToken)}`,
    input.siteUrl,
  ).toString();

  const publicToken =
    contact.publicAccessToken ??
    (await input.circulation.ensurePublicAccessToken(accountId, contact.email));
  const manageUrl = publicToken
    ? new URL(`/share/matches/${publicToken}`, input.siteUrl).toString()
    : null;

  const html = buildCirculationDigestEmailHtml({
    brand: input.emailBrand,
    listings: listings.map((listing) => ({
      name: listing.name,
      summary: listing.summary,
      address: listing.address,
      viewUrl: listing.viewUrl,
      sizeLabel: listing.sizeLabel,
      disposalTypeLabel: listing.disposalTypeLabel,
    })),
    unsubscribeUrl,
    manageUrl,
    contactName: contact.contactName,
  });

  if (input.dryRun) {
    await input.db.from('commercial_circulation_recipients').insert({
      send_id: sendId,
      account_id: accountId,
      requirement_id: requirementId,
      email: contact.email,
      status: 'skipped',
      skip_reason: 'dry_run',
    });
    return { mailed: 0, skipped: 1, failed: 0, dryRunEligible: 1 };
  }

  try {
    const { messageId } = await sendCirculationEmailViaSes({
      to: contact.email,
      from: input.fromHeader,
      replyTo: input.replyTo,
      subject: input.subject,
      html,
      listUnsubscribeUrl: unsubscribeUrl,
      accountId,
      metadata: {
        send_id: sendId,
        send_kind: 'digest',
        listing_ids: listings.map((listing) => listing.listingId),
        trigger_listing_id: input.triggerListingId,
        requirement_ids: contact.requirementIds,
      },
    });

    await input.db.from('commercial_circulation_recipients').insert({
      send_id: sendId,
      account_id: accountId,
      requirement_id: requirementId,
      email: contact.email,
      status: 'sent',
      ses_message_id: messageId,
    });

    await input.circulation.recordDigestSent({
      accountId,
      email: contact.email,
      fingerprint,
    });

    for (const reqId of contact.requirementIds) {
      await input.client
        .from('commercial_requirements')
        .update({ details_sent: true })
        .eq('id', reqId)
        .eq('account_id', accountId);
    }

    if (input.triggerListingId) {
      for (const reqId of contact.requirementIds) {
        await input.db.from('commercial_matches').upsert(
          {
            account_id: accountId,
            listing_id: input.triggerListingId,
            requirement_id: reqId,
            status: 'new',
            notes: 'Created from match digest',
          },
          { onConflict: 'listing_id,requirement_id', ignoreDuplicates: true },
        );
      }
    }

    return { mailed: 1, skipped: 0, failed: 0, dryRunEligible: 0 };
  } catch (err) {
    await input.db.from('commercial_circulation_recipients').insert({
      send_id: sendId,
      account_id: accountId,
      requirement_id: requirementId,
      email: contact.email,
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Send failed',
    });
    return { mailed: 0, skipped: 0, failed: 1, dryRunEligible: 0 };
  }
}
