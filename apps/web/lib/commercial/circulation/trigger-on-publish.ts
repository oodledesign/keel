import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { runCirculationForPublishedListing } from '~/lib/commercial/circulation/auto-circulate';
import { listingBecameLiveForCirculation } from '~/lib/commercial/circulation/digest-fingerprint';

export { listingBecameLiveForCirculation };

/**
 * Fire-and-forget: new live listing → matching subscribers get their digest.
 * Cron (`/api/cron/commercial-match-digest`) is the safety net if this is missed.
 */
export function scheduleCirculationOnListingPublished(input: {
  accountId: string;
  listingId: string;
}): void {
  const run = async () => {
    try {
      const admin = getSupabaseServerAdminClient();
      await runCirculationForPublishedListing(admin, input);
    } catch (err) {
      console.error(
        '[circulation] publish trigger failed',
        input.listingId,
        err instanceof Error ? err.message : err,
      );
    }
  };

  void import('next/server')
    .then(({ after }) => {
      if (typeof after === 'function') {
        after(() => {
          void run();
        });
        return;
      }
      void run();
    })
    .catch(() => {
      void run();
    });
}
