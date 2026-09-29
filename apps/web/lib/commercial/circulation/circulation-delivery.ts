import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeCirculationEmail } from '~/lib/commercial/circulation/circulation-eligibility';
import {
  type ListingChange,
  isSentBeforeChange,
} from '~/lib/commercial/circulation/circulation-rematch';
import {
  CIRCULATION_CONTACT_STATE_TABLE,
  CIRCULATION_PURPOSE,
  createCommercialCirculationService,
} from '~/lib/commercial/circulation/circulation.service';

const EMAIL_CHUNK = 50;
const PAGE_SIZE = 1000;

export type CirculationMatchPair = { listingId: string; requirementId: string };

export type ContactSentListings = {
  /** Listings the contact has been shown and that have not changed since. */
  sent: Set<string>;
  /** Listings they were shown, but that changed materially afterwards. */
  changedSince: Set<string>;
};

/**
 * Listings already shown to each contact, keyed by normalised email. A listing
 * in `activeChanges` that changed after the contact was last sent it is
 * reported in `changedSince` instead of `sent`, so it counts as new again.
 */
export async function loadSentListingState(
  client: SupabaseClient,
  accountId: string,
  emails: string[],
  activeChanges: ReadonlyMap<string, ListingChange> = new Map(),
): Promise<Map<string, ContactSentListings>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const normalized = [
    ...new Set(emails.map(normalizeCirculationEmail).filter(Boolean)),
  ];
  const map = new Map<string, ContactSentListings>();

  for (let i = 0; i < normalized.length; i += EMAIL_CHUNK) {
    const chunk = normalized.slice(i, i + EMAIL_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from('commercial_circulation_sent_listings')
        .select('email, listing_id, last_sent_at')
        .eq('account_id', accountId)
        .in('email', chunk)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{
        email: string;
        listing_id: string;
        last_sent_at: string;
      }>;
      for (const row of rows) {
        const email = normalizeCirculationEmail(row.email);
        const state = map.get(email) ?? {
          sent: new Set<string>(),
          changedSince: new Set<string>(),
        };
        if (
          isSentBeforeChange(
            row.last_sent_at,
            activeChanges.get(row.listing_id),
          )
        ) {
          state.changedSince.add(row.listing_id);
        } else {
          state.sent.add(row.listing_id);
        }
        map.set(email, state);
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }

  return map;
}

/**
 * Bookkeeping after an email was accepted by SES. Every send path calls this
 * so sent-listing history, match records and details_sent stay consistent.
 * Steps are independent and logged on failure: the email has already gone.
 */
export async function recordCirculationDelivery(
  client: SupabaseClient,
  input: {
    accountId: string;
    email: string;
    sendId: string;
    listingIds: string[];
    matchPairs: CirculationMatchPair[];
    sentBy?: string | null;
    matchNotes: string;
    digestFingerprint?: string | null;
  },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const email = normalizeCirculationEmail(input.email);
  const now = new Date().toISOString();
  const listingIds = [...new Set(input.listingIds)];
  const requirementIds = [
    ...new Set(input.matchPairs.map((pair) => pair.requirementId)),
  ];

  const steps: Array<[string, () => PromiseLike<{ error: unknown }>]> = [];

  if (listingIds.length > 0) {
    steps.push([
      'sent listings',
      () =>
        db.from('commercial_circulation_sent_listings').upsert(
          listingIds.map((listingId) => ({
            account_id: input.accountId,
            email,
            listing_id: listingId,
            last_sent_at: now,
            last_send_id: input.sendId,
          })),
          { onConflict: 'account_id,email,listing_id' },
        ),
    ]);
  }

  // Upsert: contacts who never opted in have no consent row but still need
  // their send time recorded and their claim released.
  steps.push([
    'contact send state',
    () =>
      db.from(CIRCULATION_CONTACT_STATE_TABLE).upsert(
        {
          account_id: input.accountId,
          email,
          last_circulated_at: now,
          circulation_claimed_at: null,
          updated_at: now,
        },
        { onConflict: 'account_id,email' },
      ),
  ]);

  if (input.digestFingerprint != null) {
    // Legacy fingerprint on the consent row; a no-op for contacts without one.
    steps.push([
      'digest fingerprint',
      () =>
        db
          .from('commercial_marketing_preferences')
          .update({
            last_digest_fingerprint: input.digestFingerprint,
            last_digest_sent_at: now,
          })
          .eq('account_id', input.accountId)
          .eq('email', email)
          .eq('purpose', CIRCULATION_PURPOSE),
    ]);
  }

  if (requirementIds.length > 0) {
    steps.push([
      'details sent',
      () =>
        db
          .from('commercial_requirements')
          .update({ details_sent: true })
          .eq('account_id', input.accountId)
          .in('id', requirementIds),
    ]);
  }

  if (input.matchPairs.length > 0) {
    steps.push([
      'match records',
      () =>
        db.from('commercial_matches').upsert(
          input.matchPairs.map((pair) => ({
            account_id: input.accountId,
            listing_id: pair.listingId,
            requirement_id: pair.requirementId,
            status: 'new',
            notes: input.matchNotes,
            ...(input.sentBy ? { created_by: input.sentBy } : {}),
          })),
          { onConflict: 'listing_id,requirement_id', ignoreDuplicates: true },
        ),
    ]);
  }

  for (const [label, run] of steps) {
    try {
      const { error } = await run();
      if (error) {
        console.error(
          `[circulation] record ${label} failed`,
          input.accountId,
          error instanceof Error
            ? error.message
            : (error as { message?: string }).message,
        );
      }
    } catch (err) {
      console.error(
        `[circulation] record ${label} failed`,
        input.accountId,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export async function releaseCirculationClaimQuietly(
  client: SupabaseClient,
  accountId: string,
  email: string,
): Promise<void> {
  try {
    await createCommercialCirculationService(client).releaseContactClaim(
      accountId,
      email,
    );
  } catch (err) {
    console.error(
      '[circulation] release claim failed',
      accountId,
      err instanceof Error ? err.message : err,
    );
  }
}
