import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomInt } from 'crypto';

/** Inclusive range for public-facing ticket references (avoids tiny sequential IDs). */
const TICKET_NUMBER_MIN = 10_000;
const TICKET_NUMBER_MAX = 99_999;
const MAX_ATTEMPTS = 12;

/**
 * Allocate a random ticket reference unique within the workspace account.
 * Retries on collision; unique indexes remain the final safety net.
 */
export async function allocateSupportTicketNumber(
  client: SupabaseClient,
  accountId: string,
): Promise<number> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = randomInt(TICKET_NUMBER_MIN, TICKET_NUMBER_MAX + 1);

    const { data } = await client
      .from('support_tickets')
      .select('id')
      .or(`account_id.eq.${accountId},business_id.eq.${accountId}`)
      .eq('ticket_number', candidate)
      .limit(1)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
  }

  throw new Error('Could not allocate a unique support ticket number');
}
