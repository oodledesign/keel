import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  IgConnectedAccountRow,
  IgContactRow,
  IgRunSource,
  IgTriggerFullRow,
} from '../types';
import { hasPriorRun, isInCooldown } from './guards';
import { advanceRun } from './run-engine';

export type StartIgRunResult =
  | { status: 'started'; runId: string }
  | { status: 'duplicate' }
  | {
      status: 'skipped';
      reason: 'opted_out' | 'once_per_contact' | 'cooldown';
    };

/**
 * Start a sequence for a contact. The unique (trigger_id, source_event_id)
 * constraint makes this idempotent: a replayed webhook finds the existing
 * run and sends nothing.
 */
export async function startIgRun(
  admin: SupabaseClient,
  params: {
    trigger: IgTriggerFullRow;
    igAccount: IgConnectedAccountRow;
    contact: IgContactRow;
    source: IgRunSource;
    sourceEventId: string;
    sourceCommentId?: string | null;
    /** Test sends from the builder skip once-per-contact and cooldown. */
    skipGuards?: boolean;
  },
): Promise<StartIgRunResult> {
  const { trigger, contact } = params;

  if (contact.opted_out_at) return { status: 'skipped', reason: 'opted_out' };

  if (!params.skipGuards) {
    if (
      trigger.once_per_contact &&
      (await hasPriorRun(admin, trigger.id, contact.id))
    ) {
      return { status: 'skipped', reason: 'once_per_contact' };
    }
    if (
      await isInCooldown(admin, {
        triggerId: trigger.id,
        contactId: contact.id,
        cooldownMinutes: trigger.cooldown_minutes,
      })
    ) {
      return { status: 'skipped', reason: 'cooldown' };
    }
  }

  const { data, error } = await admin
    .from('ig_automation_runs')
    .upsert(
      {
        account_id: trigger.account_id,
        ig_account_id: params.igAccount.id,
        contact_id: contact.id,
        trigger_id: trigger.id,
        source: params.source,
        source_event_id: params.sourceEventId,
        source_comment_id: params.sourceCommentId ?? null,
        status: 'active',
        current_position: 0,
      },
      { onConflict: 'trigger_id,source_event_id', ignoreDuplicates: true },
    )
    .select('id');

  if (error) throw new Error(error.message);
  const row = data?.[0] as { id: string } | undefined;
  if (!row) return { status: 'duplicate' };

  await advanceRun(admin, row.id);
  return { status: 'started', runId: row.id };
}
