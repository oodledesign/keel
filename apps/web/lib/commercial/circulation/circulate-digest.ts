import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type CirculationSendTrigger,
  resolveCirculationIdentity,
} from '~/lib/commercial/circulation/circulate-listing';
import {
  loadSentListingState,
  recordCirculationDelivery,
  releaseCirculationClaimQuietly,
} from '~/lib/commercial/circulation/circulation-delivery';
import {
  type CirculationEmailBrand,
  buildCirculationDigestEmailHtml,
} from '~/lib/commercial/circulation/circulation-email';
import {
  CHANGE_KIND_LABELS,
  type ListingChange,
  activeListingChanges,
} from '~/lib/commercial/circulation/circulation-rematch';
import {
  hasUnsentListing,
  isWithinMinGap,
  minGapCutoff,
  orderByLeastRecentlyCirculated,
  pickListingsForEmail,
} from '~/lib/commercial/circulation/circulation-selection';
import {
  buildCirculationUnsubscribeUrls,
  createCommercialCirculationService,
  sendCirculationEmailViaSes,
} from '~/lib/commercial/circulation/circulation.service';
import {
  type ContactMatchListing,
  type ContactMatchRow,
  isContactAutoMailEligible,
  listContactMatches,
} from '~/lib/commercial/circulation/contact-matches';
import { matchDigestFingerprint } from '~/lib/commercial/circulation/digest-fingerprint';

const MAX_CONTACTS_PER_RUN = 80;
const MAX_LISTINGS_PER_EMAIL = 12;

export type DigestMailoutResult = {
  sendId: string | null;
  mailed: number;
  skipped: number;
  failed: number;
  dryRunEligible: number;
  contactsConsidered: number;
  /** Eligible contacts with nothing new since their last email. */
  nothingNew: number;
  /** Contacts with new matches held back by the workspace minimum gap. */
  withinGap: number;
  /** Contacts with new matches left for the next run by the per-run cap. */
  deferred: number;
};

type PlannedDigest = {
  contact: ContactMatchRow;
  listings: ContactMatchListing[];
  /** Listings this contact was sent before they changed (re-notify). */
  changedSince: ReadonlySet<string>;
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

function digestSubject(
  agencyName: string,
  count: number,
  singleListingBadge: string | null,
): string {
  if (count === 1 && singleListingBadge) {
    return `${singleListingBadge} — matching opportunity from ${agencyName}`;
  }
  if (count === 1) return `Matching opportunity from ${agencyName}`;
  return `${count} matching opportunities from ${agencyName}`;
}

/**
 * The one send path for match emails (go-live trigger, daily cron, manual
 * "Send now"). Only contacts with at least one listing they have not been
 * shown get an email; auto sends also respect the workspace minimum gap.
 */
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
    /** Auto runs need a new match on at least one auto-circulate listing. */
    requireAutoCirculateListing?: boolean;
    /** Skip contacts who are not subscribed or have paused auto-send. */
    autoEligibility?: boolean;
    /** Minimum days since the contact's last email. Auto sends only. */
    minGapDays?: number;
  },
): Promise<DigestMailoutResult> {
  const sendTrigger: CirculationSendTrigger = input.dryRun
    ? 'dry_run'
    : (input.sendTrigger ?? 'manual');
  const autoEligibility = input.autoEligibility ?? sendTrigger === 'auto';
  const minGapDays = sendTrigger === 'auto' ? (input.minGapDays ?? 0) : 0;
  const now = new Date();

  const identity = await resolveCirculationIdentity(client, input.accountId);
  const fromEmail = identity.fromEmail;
  if (!fromEmail) {
    throw new Error(
      'Add a verified sending domain in workspace settings, or set a contact email that can send from Ozer.',
    );
  }

  const contacts = await listContactMatches(client, {
    accountId: input.accountId,
    siteUrl: input.siteUrl,
    requireListingId: input.triggerListingId ?? undefined,
  });

  const eligible = contacts.filter((row) =>
    autoEligibility ? isContactAutoMailEligible(row) : true,
  );

  // Workspace-opt-in: a listing that changed since a contact was sent it
  // counts as new for them again. Nothing changes while both toggles are off.
  const settings = await createCommercialCirculationService(
    client,
  ).getOrCreateSettings(input.accountId);
  const activeChanges = activeListingChanges(
    [
      ...new Map(
        eligible
          .flatMap((row) => row.listings)
          .map((listing) => [listing.listingId, listing] as const),
      ).values(),
    ].map((listing) => ({
      listingId: listing.listingId,
      changes: listing.changes,
    })),
    {
      onPriceDrop: settings.rematch_on_price_drop,
      onRelist: settings.rematch_on_relist,
    },
    now,
  );

  const sentByEmail = await loadSentListingState(
    client,
    input.accountId,
    eligible.map((row) => row.email),
    activeChanges,
  );

  let nothingNew = 0;
  let withinGap = 0;
  const ready: ContactMatchRow[] = [];
  for (const contact of eligible) {
    const sent = sentByEmail.get(contact.email)?.sent ?? new Set<string>();
    if (
      !hasUnsentListing(contact.listings, sent, {
        requireAutoCirculate: input.requireAutoCirculateListing,
      })
    ) {
      nothingNew += 1;
      continue;
    }
    if (isWithinMinGap(contact.lastCirculatedAt, minGapDays, now)) {
      withinGap += 1;
      continue;
    }
    ready.push(contact);
  }

  const ordered = orderByLeastRecentlyCirculated(ready);
  const deferred = Math.max(0, ordered.length - MAX_CONTACTS_PER_RUN);
  if (deferred > 0) {
    console.warn(
      `[circulation] ${deferred} contact(s) with new matches deferred by the ${MAX_CONTACTS_PER_RUN}-per-run cap`,
      input.accountId,
    );
  }

  const planned: PlannedDigest[] = ordered
    .slice(0, MAX_CONTACTS_PER_RUN)
    .map((contact) => ({
      contact,
      listings: pickListingsForEmail(
        contact.listings,
        sentByEmail.get(contact.email)?.sent ?? new Set<string>(),
        MAX_LISTINGS_PER_EMAIL,
        input.triggerListingId,
      ),
      changedSince:
        sentByEmail.get(contact.email)?.changedSince ?? new Set<string>(),
    }));

  const summary = {
    contactsConsidered: contacts.length,
    nothingNew,
    withinGap,
    deferred,
  };

  if (planned.length === 0) {
    return {
      sendId: null,
      mailed: 0,
      skipped: contacts.length,
      failed: 0,
      dryRunEligible: 0,
      ...summary,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const listingIds = [
    ...new Set(
      planned.flatMap((plan) => plan.listings.map((l) => l.listingId)),
    ),
  ];
  const subject = `Matching opportunities from ${identity.agencyName}`;
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
  const gapCutoff = minGapCutoff(minGapDays, now);
  let mailed = 0;
  let skipped = contacts.length - planned.length;
  let failed = 0;
  let dryRunEligible = 0;

  for (const plan of planned) {
    const result = await sendOneDigest({
      client,
      db,
      circulation,
      plan,
      activeChanges,
      accountId: input.accountId,
      sendId,
      siteUrl: input.siteUrl,
      fromHeader,
      replyTo,
      agencyName: identity.agencyName,
      emailBrand,
      dryRun: Boolean(input.dryRun),
      triggerListingId: input.triggerListingId ?? null,
      sentBy: input.sentBy ?? null,
      gapCutoff,
      requireAutoCirculate: Boolean(input.requireAutoCirculateListing),
      sesTenant: identity.sesTenantName,
      sesConfigurationSet: identity.sesConfigurationSet,
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

  if (!input.dryRun && mailed > 0) {
    try {
      const { recordCommercialAccountEvent } =
        await import('~/lib/commercial/account-events');
      await recordCommercialAccountEvent(client, {
        accountId: input.accountId,
        entityType: input.triggerListingId ? 'listing' : 'other',
        entityId: input.triggerListingId ?? sendId,
        eventType: 'circulation_sent',
        summary: `Circulation digest emailed to ${mailed} contact${mailed === 1 ? '' : 's'}`,
        actorUserId: input.sentBy ?? null,
        metadata: {
          sendId,
          mailed,
          skipped,
          failed,
          sendKind: 'digest',
        },
      });
    } catch {
      /* best-effort */
    }
  }

  return {
    sendId,
    mailed,
    skipped,
    failed,
    dryRunEligible,
    ...summary,
  };
}

async function sendOneDigest(input: {
  client: SupabaseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  circulation: ReturnType<typeof createCommercialCirculationService>;
  plan: PlannedDigest;
  activeChanges: ReadonlyMap<string, ListingChange>;
  accountId: string;
  sendId: string;
  siteUrl: string;
  fromHeader: string;
  replyTo: string;
  agencyName: string;
  emailBrand: CirculationEmailBrand;
  dryRun: boolean;
  triggerListingId: string | null;
  sentBy: string | null;
  gapCutoff: Date | null;
  requireAutoCirculate: boolean;
  sesTenant: string | null;
  sesConfigurationSet: string | null;
}): Promise<{
  mailed: number;
  skipped: number;
  failed: number;
  dryRunEligible: number;
}> {
  const { plan, accountId, sendId } = input;
  const { contact } = plan;
  let listings = plan.listings;
  let changedSince = plan.changedSince;
  const requirementId = contact.requirementIds[0] ?? null;

  const logRecipient = (
    row:
      | { status: 'skipped'; skip_reason: string }
      | { status: 'sent'; ses_message_id: string | null }
      | { status: 'failed'; error_message: string },
  ) =>
    input.db.from('commercial_circulation_recipients').insert({
      send_id: sendId,
      account_id: accountId,
      requirement_id: requirementId,
      email: contact.email,
      ...row,
    });

  if (!input.dryRun) {
    const claimed = await input.circulation.claimContactForSend({
      accountId,
      email: contact.email,
      notCirculatedSince: input.gapCutoff,
    });
    if (!claimed) {
      await logRecipient({ status: 'skipped', skip_reason: 'claimed' });
      return { mailed: 0, skipped: 1, failed: 0, dryRunEligible: 0 };
    }

    // Another run may have emailed this contact between planning and claiming.
    const freshState = (
      await loadSentListingState(
        input.client,
        accountId,
        [contact.email],
        input.activeChanges,
      )
    ).get(contact.email);
    const fresh = freshState?.sent ?? new Set<string>();
    changedSince = freshState?.changedSince ?? new Set<string>();
    if (
      !hasUnsentListing(contact.listings, fresh, {
        requireAutoCirculate: input.requireAutoCirculate,
      })
    ) {
      await releaseCirculationClaimQuietly(
        input.client,
        accountId,
        contact.email,
      );
      return { mailed: 0, skipped: 1, failed: 0, dryRunEligible: 0 };
    }
    listings = pickListingsForEmail(
      contact.listings,
      fresh,
      MAX_LISTINGS_PER_EMAIL,
      input.triggerListingId,
    );
  }

  const shownIds = listings.map((listing) => listing.listingId);
  const changeLabelFor = (listingId: string): string | null => {
    if (!changedSince.has(listingId)) return null;
    const change = input.activeChanges.get(listingId);
    return change ? CHANGE_KIND_LABELS[change.kind] : null;
  };
  const subject = digestSubject(
    input.agencyName,
    listings.length,
    listings.length === 1 ? changeLabelFor(listings[0]!.listingId) : null,
  );

  try {
    const { pageUrl, oneClickUrl } = buildCirculationUnsubscribeUrls({
      accountId,
      email: contact.email,
      siteUrl: input.siteUrl,
    });

    const publicToken =
      contact.publicAccessToken ??
      (await input.circulation.ensurePublicAccessToken(
        accountId,
        contact.email,
      ));
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
        viewUrlLabel: listing.viewUrlLabel,
        coverImageUrl: listing.coverImageUrl,
        sizeLabel: listing.sizeLabel,
        disposalTypeLabel: listing.disposalTypeLabel,
        badge: changeLabelFor(listing.listingId),
      })),
      unsubscribeUrl: pageUrl,
      manageUrl,
      contactName: contact.contactName,
    });

    if (input.dryRun) {
      await logRecipient({ status: 'skipped', skip_reason: 'dry_run' });
      return { mailed: 0, skipped: 1, failed: 0, dryRunEligible: 1 };
    }

    const { messageId } = await sendCirculationEmailViaSes({
      to: contact.email,
      from: input.fromHeader,
      replyTo: input.replyTo,
      subject,
      html,
      listUnsubscribeUrl: oneClickUrl,
      accountId,
      sesTenant: input.sesTenant ?? undefined,
      sesConfigurationSet: input.sesConfigurationSet ?? undefined,
      metadata: {
        send_id: sendId,
        send_kind: 'digest',
        listing_ids: shownIds,
        trigger_listing_id: input.triggerListingId,
        requirement_ids: contact.requirementIds,
      },
    });

    await logRecipient({ status: 'sent', ses_message_id: messageId });

    await recordCirculationDelivery(input.client, {
      accountId,
      email: contact.email,
      sendId,
      listingIds: shownIds,
      matchPairs: listings.flatMap((listing) =>
        listing.requirementIds.map((reqId) => ({
          listingId: listing.listingId,
          requirementId: reqId,
        })),
      ),
      sentBy: input.sentBy,
      matchNotes: 'Created from match digest',
      digestFingerprint: matchDigestFingerprint(shownIds),
    });

    return { mailed: 1, skipped: 0, failed: 0, dryRunEligible: 0 };
  } catch (err) {
    if (!input.dryRun) {
      await releaseCirculationClaimQuietly(
        input.client,
        accountId,
        contact.email,
      );
    }
    await logRecipient({
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Send failed',
    });
    return { mailed: 0, skipped: 0, failed: 1, dryRunEligible: 0 };
  }
}
