import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeCirculationEmail } from '~/lib/commercial/circulation/circulation-eligibility';

export type ConsentStatus = 'subscribed' | 'unsubscribed' | 'suppressed';

const STRICTNESS: Record<ConsentStatus, number> = {
  subscribed: 0,
  unsubscribed: 1,
  suppressed: 2,
};

export type ConsentCarryAction =
  | { kind: 'none' }
  | { kind: 'copy' }
  | { kind: 'restrict'; status: ConsentStatus };

/**
 * What to do with the consent held on a contact's old address when their
 * email changes. Consent follows the person, but a carry can only ever make
 * the new address stricter: an unsubscribed or suppressed address is never
 * re-subscribed, and nothing is created when the old address had no record.
 */
export function planConsentCarry(
  oldStatus: ConsentStatus | null,
  newStatus: ConsentStatus | null,
): ConsentCarryAction {
  if (!oldStatus) return { kind: 'none' };
  if (!newStatus) return { kind: 'copy' };
  if (STRICTNESS[oldStatus] > STRICTNESS[newStatus]) {
    return { kind: 'restrict', status: oldStatus };
  }
  return { kind: 'none' };
}

type PreferenceTable = {
  table: 'commercial_marketing_preferences' | 'workspace_mailing_preferences';
  purpose: string;
  copyColumns: string[];
};

const PREFERENCE_TABLES: PreferenceTable[] = [
  {
    table: 'commercial_marketing_preferences',
    purpose: 'matching_disposals',
    copyColumns: [
      'marketing_status',
      'lawful_basis',
      'consent_source',
      'consent_copy_version',
      'consented_at',
      'unsubscribed_at',
      'suppressed_at',
      'suppression_reason',
      'auto_send_enabled',
    ],
  },
  {
    table: 'workspace_mailing_preferences',
    purpose: 'workspace_mailing_list',
    copyColumns: [
      'marketing_status',
      'lawful_basis',
      'consent_source',
      'consent_copy_version',
      'consented_at',
      'unsubscribed_at',
      'suppressed_at',
    ],
  },
];

export type ConsentCarryResult = {
  table: PreferenceTable['table'];
  action: ConsentCarryAction['kind'];
};

/**
 * Carry circulation and newsletter consent, plus circulation send history,
 * from a contact's old address to the new one. The old rows are left in place
 * so the old address stays blocked if it was blocked.
 */
export async function carryContactConsentToEmail(
  client: SupabaseClient,
  input: {
    accountId: string;
    clientId: string | null;
    oldEmail: string | null | undefined;
    newEmail: string | null | undefined;
  },
): Promise<ConsentCarryResult[]> {
  const oldEmail = normalizeCirculationEmail(input.oldEmail ?? '');
  const newEmail = normalizeCirculationEmail(input.newEmail ?? '');
  if (!oldEmail.includes('@') || !newEmail.includes('@')) return [];
  if (oldEmail === newEmail) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const results: ConsentCarryResult[] = [];
  const now = new Date().toISOString();

  for (const spec of PREFERENCE_TABLES) {
    const select = ['email', 'client_id', ...spec.copyColumns].join(', ');
    const { data, error } = await db
      .from(spec.table)
      .select(select)
      .eq('account_id', input.accountId)
      .eq('purpose', spec.purpose)
      .in('email', [oldEmail, newEmail]);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const oldRow = rows.find((row) => row.email === oldEmail) ?? null;
    const newRow = rows.find((row) => row.email === newEmail) ?? null;
    const action = planConsentCarry(
      (oldRow?.marketing_status as ConsentStatus | undefined) ?? null,
      (newRow?.marketing_status as ConsentStatus | undefined) ?? null,
    );

    if (action.kind === 'copy' && oldRow) {
      const copied: Record<string, unknown> = {
        account_id: input.accountId,
        email: newEmail,
        purpose: spec.purpose,
        client_id: input.clientId ?? oldRow.client_id ?? null,
        updated_at: now,
      };
      for (const column of spec.copyColumns) copied[column] = oldRow[column];
      const { error: insertError } = await db.from(spec.table).insert(copied);
      if (insertError) throw new Error(insertError.message);
    } else if (action.kind === 'restrict') {
      const patch: Record<string, unknown> = {
        marketing_status: action.status,
        updated_at: now,
      };
      if (action.status === 'unsubscribed') {
        patch.unsubscribed_at = oldRow?.unsubscribed_at ?? now;
      } else {
        patch.suppressed_at = oldRow?.suppressed_at ?? now;
      }
      const { error: updateError } = await db
        .from(spec.table)
        .update(patch)
        .eq('account_id', input.accountId)
        .eq('purpose', spec.purpose)
        .eq('email', newEmail);
      if (updateError) throw new Error(updateError.message);
    }

    results.push({ table: spec.table, action: action.kind });
  }

  await carryCirculationSendState(db, input.accountId, oldEmail, newEmail);
  return results;
}

/** Keep "already sent" and the minimum gap working across the address change. */
async function carryCirculationSendState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  accountId: string,
  oldEmail: string,
  newEmail: string,
) {
  const { data: sent, error: sentError } = await db
    .from('commercial_circulation_sent_listings')
    .select('listing_id, first_sent_at, last_sent_at, last_send_id')
    .eq('account_id', accountId)
    .eq('email', oldEmail);
  if (sentError) throw new Error(sentError.message);

  const sentRows = (sent ?? []) as Array<Record<string, unknown>>;
  if (sentRows.length > 0) {
    const { error } = await db
      .from('commercial_circulation_sent_listings')
      .upsert(
        sentRows.map((row) => ({
          ...row,
          account_id: accountId,
          email: newEmail,
        })),
        {
          onConflict: 'account_id,email,listing_id',
          ignoreDuplicates: true,
        },
      );
    if (error) throw new Error(error.message);
  }

  const { data: states, error: stateError } = await db
    .from('commercial_circulation_contact_state')
    .select('email, last_circulated_at')
    .eq('account_id', accountId)
    .in('email', [oldEmail, newEmail]);
  if (stateError) throw new Error(stateError.message);

  const stateRows = (states ?? []) as Array<{
    email: string;
    last_circulated_at: string | null;
  }>;
  const oldLast =
    stateRows.find((row) => row.email === oldEmail)?.last_circulated_at ?? null;
  const newLast =
    stateRows.find((row) => row.email === newEmail)?.last_circulated_at ?? null;
  if (!oldLast || (newLast && Date.parse(newLast) >= Date.parse(oldLast))) {
    return;
  }

  const { error } = await db
    .from('commercial_circulation_contact_state')
    .upsert(
      {
        account_id: accountId,
        email: newEmail,
        last_circulated_at: oldLast,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,email' },
    );
  if (error) throw new Error(error.message);
}
