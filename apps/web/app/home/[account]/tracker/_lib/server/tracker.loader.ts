import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createCompetitorTrackerService } from '~/lib/commercial/competitor-tracker';

export async function loadTrackerWorkspace(accountId: string) {
  const service = createCompetitorTrackerService(getSupabaseServerClient());
  const [listings, watches, notifications] = await Promise.all([
    service.listListings(accountId),
    service.listWatches(accountId),
    service.listNotifications(accountId, 40),
  ]);

  return { listings, watches, notifications };
}
