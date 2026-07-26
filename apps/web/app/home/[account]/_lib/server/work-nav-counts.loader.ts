'use server';

import 'server-only';

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import { isWorkModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { countOpenSupportTickets } from '~/home/[account]/support/_lib/server/support-tickets.service';
import { countActiveSharesForGuest } from '~/lib/clients/client-workspace-shares.service';
import { countPartnerSupportLinks } from '~/lib/support/partner-support.service';

function formatSupabaseError(error: PostgrestError | null | undefined): string {
  if (!error) return 'Unknown error';
  const parts = [error.message, error.details, error.hint, error.code].filter(
    (part) => typeof part === 'string' && part.trim().length > 0,
  );
  return parts.join(' · ') || 'Unknown error';
}

function isMissingRelationError(error: PostgrestError): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist/i.test(error.message ?? '')
  );
}

export async function loadWorkNavCounts(
  client: SupabaseClient,
  accountId: string,
  moduleSettings?: Record<string, boolean>,
): Promise<WorkNavCounts> {
  const counts: WorkNavCounts = {};

  try {
    const partnerLinkCount = await countPartnerSupportLinks(accountId);
    counts.hasPartnerSupportLinks = partnerLinkCount > 0;
  } catch (error) {
    const pgError = error as PostgrestError;
    if (!pgError?.code || !isMissingRelationError(pgError)) {
      console.warn(
        '[work-nav-counts] hasPartnerSupportLinks:',
        formatSupabaseError(pgError),
      );
    }
  }

  try {
    const sharedCount = await countActiveSharesForGuest(accountId);
    counts.hasSharedClients = sharedCount > 0;
  } catch (error) {
    const pgError = error as PostgrestError;
    if (!pgError?.code || !isMissingRelationError(pgError)) {
      console.warn(
        '[work-nav-counts] hasSharedClients:',
        formatSupabaseError(pgError),
      );
    }
  }

  if (!isWorkModuleEnabled(moduleSettings, 'support_tickets')) {
    return counts;
  }

  try {
    counts.supportOpenCount = await countOpenSupportTickets(client, accountId);
  } catch (error) {
    const pgError = error as PostgrestError;
    if (pgError?.code && isMissingRelationError(pgError)) {
      return counts;
    }

    console.warn(
      '[work-nav-counts] supportOpenCount:',
      formatSupabaseError(pgError),
    );
  }

  return counts;
}
