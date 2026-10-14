import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  IgContactConsentRecord,
  IgContactRow,
  IgRunAwaiting,
  IgRunRow,
} from '../types';
import { validateCollectedValue } from './collect-validate';
import { loadIgContact } from './contacts';
import { syncIgContactToClient } from './crm-sync';
import { attributeInboundEvent } from './message-events';
import type { ParsedRunPayload } from './payload';
import { advanceRun, loadSequenceSteps } from './run-engine';
import { type IgStep, type IgStepConfigMap, resolveGoto } from './step-types';

const DEFAULT_CONSENT_PURPOSE = 'Marketing messages';

async function lockRun(admin: SupabaseClient, runId: string) {
  const { data, error } = await admin.rpc('lock_ig_automation_run', {
    p_run_id: runId,
  });
  return !error && Boolean(data);
}

async function unlockRun(admin: SupabaseClient, runId: string) {
  await admin
    .from('ig_automation_runs')
    .update({ locked_until: null })
    .eq('id', runId);
}

/**
 * Lock a run that is waiting for this contact's reply. Returns null (and
 * leaves nothing locked) if the run has moved on, so stale or replayed taps
 * are ignored.
 */
async function claimWaitingRun(
  admin: SupabaseClient,
  params: {
    runId: string;
    contactId: string;
    accept: (awaiting: IgRunAwaiting) => boolean;
  },
): Promise<IgRunRow | null> {
  if (!(await lockRun(admin, params.runId))) return null;

  const { data } = await admin
    .from('ig_automation_runs')
    .select('*')
    .eq('id', params.runId)
    .eq('contact_id', params.contactId)
    .maybeSingle();
  const run = data as IgRunRow | null;

  if (
    !run ||
    run.status !== 'waiting_reply' ||
    !run.awaiting ||
    !params.accept(run.awaiting)
  ) {
    await unlockRun(admin, params.runId);
    return null;
  }
  return run;
}

async function continueRun(
  admin: SupabaseClient,
  run: IgRunRow,
  patch: Record<string, unknown>,
) {
  const { error } = await admin
    .from('ig_automation_runs')
    .update({
      status: 'active',
      awaiting: null,
      next_step_at: null,
      attempts: 0,
      ...patch,
    })
    .eq('id', run.id)
    .eq('status', 'waiting_reply');

  if (error) {
    await unlockRun(admin, run.id);
    throw new Error(error.message);
  }
  await advanceRun(admin, run.id, { lockHeld: true });
}

function nextPositionForChoice(
  steps: IgStep[],
  position: number,
  choice: number,
): number | null {
  const step = steps[position];
  if (!step) return null;
  if (step.step_type === 'quick_replies') {
    const option = step.config.options[choice];
    return option ? resolveGoto(steps, position, option.goto) : null;
  }
  if (step.step_type === 'buttons') {
    const button = step.config.buttons[choice];
    if (!button || button.type !== 'postback') return null;
    return resolveGoto(steps, position, button.goto);
  }
  return null;
}

/** A quick reply or button tapped in a sequence (`igrun:` payload). */
export async function resumeRunFromPayload(
  admin: SupabaseClient,
  params: {
    contactId: string;
    payload: ParsedRunPayload;
    messageId?: string | null;
  },
): Promise<boolean> {
  const { payload } = params;
  const run = await claimWaitingRun(admin, {
    runId: payload.runId,
    contactId: params.contactId,
    accept: (awaiting) =>
      awaiting.position === payload.position &&
      (awaiting.kind === 'quick_reply' ||
        awaiting.kind === 'button' ||
        awaiting.kind === 'collect_data'),
  });
  if (!run) return false;

  try {
    const { steps } = await loadSequenceSteps(admin, run.trigger_id);
    const step = steps[payload.position];

    if (
      step?.step_type === 'collect_data' &&
      run.awaiting?.kind === 'collect_data'
    ) {
      if (step.config.field !== 'consent') {
        await unlockRun(admin, run.id);
        return false;
      }
      await applyCollectedAnswer(admin, {
        run,
        step: step.config,
        awaiting: run.awaiting,
        answer: payload.choice === 0 ? 'yes' : 'no',
        messageId: params.messageId ?? null,
      });
      return true;
    }

    const next = nextPositionForChoice(steps, payload.position, payload.choice);
    if (next === null || !step) {
      await unlockRun(admin, run.id);
      return false;
    }
    await attributeInboundEvent(admin, {
      contactId: run.contact_id,
      metaMessageId: params.messageId,
      runId: run.id,
      triggerId: run.trigger_id,
      stepPosition: payload.position,
      stepType: step.step_type,
    });
    await continueRun(admin, run, { current_position: next });
    return true;
  } catch (error) {
    await unlockRun(admin, run.id);
    throw error;
  }
}

/** "I'm following" tapped on a follow gate (`igfollow:` payload). */
export async function resumeRunFromFollowCheck(
  admin: SupabaseClient,
  params: { contactId: string; runId: string },
): Promise<boolean> {
  const run = await claimWaitingRun(admin, {
    runId: params.runId,
    contactId: params.contactId,
    accept: (awaiting) => awaiting.kind === 'follow',
  });
  if (!run) return false;

  // Keep `awaiting` so the engine forces a fresh follower lookup.
  const { error } = await admin
    .from('ig_automation_runs')
    .update({ status: 'active', next_step_at: null })
    .eq('id', run.id);
  if (error) {
    await unlockRun(admin, run.id);
    throw new Error(error.message);
  }
  await advanceRun(admin, run.id, { lockHeld: true });
  return true;
}

/**
 * A typed DM from the contact. Feeds the most recent run waiting on a reply:
 * any-reply waits, data collection, or a typed answer matching a button label.
 * Returns true if a run consumed the message.
 */
export async function resumeRunsFromText(
  admin: SupabaseClient,
  params: { contactId: string; text: string; messageId?: string | null },
): Promise<boolean> {
  const { data } = await admin
    .from('ig_automation_runs')
    .select('id, trigger_id, awaiting')
    .eq('contact_id', params.contactId)
    .eq('status', 'waiting_reply')
    .order('updated_at', { ascending: false })
    .limit(5);

  const candidates = (data ?? []) as Array<
    Pick<IgRunRow, 'id' | 'trigger_id' | 'awaiting'>
  >;
  const typed = params.text.trim().toLowerCase();

  for (const candidate of candidates) {
    const awaiting = candidate.awaiting;
    if (!awaiting || awaiting.kind === 'follow') continue;

    if (awaiting.kind === 'any_reply') {
      const run = await claimWaitingRun(admin, {
        runId: candidate.id,
        contactId: params.contactId,
        accept: (a) => a.kind === 'any_reply',
      });
      if (!run) continue;
      await continueRun(admin, run, { current_position: awaiting.position });
      return true;
    }

    const { steps } = await loadSequenceSteps(admin, candidate.trigger_id);
    const step = steps[awaiting.position];
    if (!step) continue;

    if (awaiting.kind === 'collect_data' && step.step_type === 'collect_data') {
      const run = await claimWaitingRun(admin, {
        runId: candidate.id,
        contactId: params.contactId,
        accept: (a) =>
          a.kind === 'collect_data' && a.position === awaiting.position,
      });
      if (!run) continue;
      try {
        await applyCollectedAnswer(admin, {
          run,
          step: step.config,
          awaiting: run.awaiting as Extract<
            IgRunAwaiting,
            { kind: 'collect_data' }
          >,
          answer: params.text,
          messageId: params.messageId ?? null,
        });
      } catch (error) {
        await unlockRun(admin, run.id);
        throw error;
      }
      return true;
    }

    const labels =
      step.step_type === 'quick_replies'
        ? step.config.options.map((o) => o.label)
        : step.step_type === 'buttons'
          ? step.config.buttons.map((b) =>
              b.type === 'postback' ? b.label : '',
            )
          : [];
    const choice = labels.findIndex(
      (label) => label && label.trim().toLowerCase() === typed,
    );
    if (choice < 0) continue;

    const run = await claimWaitingRun(admin, {
      runId: candidate.id,
      contactId: params.contactId,
      accept: (a) =>
        (a.kind === 'quick_reply' || a.kind === 'button') &&
        a.position === awaiting.position,
    });
    if (!run) continue;
    const next = nextPositionForChoice(steps, awaiting.position, choice);
    if (next === null) {
      await unlockRun(admin, run.id);
      continue;
    }
    await attributeInboundEvent(admin, {
      contactId: run.contact_id,
      metaMessageId: params.messageId,
      runId: run.id,
      triggerId: run.trigger_id,
      stepPosition: awaiting.position,
      stepType: step.step_type,
    });
    await continueRun(admin, run, { current_position: next });
    return true;
  }

  return false;
}

/**
 * Validate and store an answer to a collect_data step, re-asking when it is
 * invalid (up to max_retries), then continue the sequence. Caller holds the
 * run lock.
 */
async function applyCollectedAnswer(
  admin: SupabaseClient,
  params: {
    run: IgRunRow;
    step: IgStepConfigMap['collect_data'];
    awaiting: Extract<IgRunAwaiting, { kind: 'collect_data' }>;
    answer: string;
    messageId: string | null;
  },
) {
  const { run, step, awaiting } = params;
  const result = validateCollectedValue(step.field, params.answer);

  if (!result.ok) {
    if (awaiting.retries < step.max_retries) {
      await continueRun(admin, run, {
        current_position: awaiting.position,
        awaiting: {
          kind: 'collect_data',
          position: awaiting.position,
          retries: awaiting.retries + 1,
        },
      });
    } else {
      await continueRun(admin, run, {
        current_position: awaiting.position + 1,
      });
    }
    return;
  }

  await attributeInboundEvent(admin, {
    contactId: run.contact_id,
    metaMessageId: params.messageId,
    runId: run.id,
    triggerId: run.trigger_id,
    stepPosition: awaiting.position,
    stepType: 'collect_data',
  });

  const contact = await loadIgContact(admin, run.contact_id);
  if (contact) {
    const updated = await storeCollectedValue(admin, {
      contact,
      step,
      value: result.value,
      position: awaiting.position,
      messageId: params.messageId,
    });

    if (step.sync_to_crm) {
      try {
        await syncIgContactToClient(admin, {
          contact: updated,
          createDeal: step.create_deal,
          dealStage: step.deal_stage,
          createTask: step.create_task,
        });
      } catch (error) {
        console.error('[ig-sequence] CRM sync failed', {
          runId: run.id,
          contactId: updated.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
  }

  await continueRun(admin, run, { current_position: awaiting.position + 1 });
}

async function storeCollectedValue(
  admin: SupabaseClient,
  params: {
    contact: IgContactRow;
    step: IgStepConfigMap['collect_data'];
    value: string;
    position: number;
    messageId: string | null;
  },
): Promise<IgContactRow> {
  const { contact, step, value } = params;
  const fields: Record<string, string> = { ...contact.custom_fields };
  const patch: Record<string, unknown> = {};

  switch (step.field) {
    case 'email':
      fields.email = value;
      break;
    case 'phone':
      fields.phone = value;
      break;
    case 'name':
      fields.name = value;
      patch.display_name = value;
      break;
    case 'text':
      fields[step.custom_field_key ?? `answer_${params.position + 1}`] = value;
      break;
    case 'consent': {
      const record: IgContactConsentRecord = {
        purpose: step.consent_purpose || DEFAULT_CONSENT_PURPOSE,
        wording: step.prompt,
        granted: value === 'yes',
        recorded_at: new Date().toISOString(),
        source_message_id: params.messageId,
      };
      patch.consent = [...(contact.consent ?? []), record];
      break;
    }
  }

  if (step.custom_field_key && step.field !== 'text') {
    fields[step.custom_field_key] = value;
  }
  patch.custom_fields = fields;

  const { data, error } = await admin
    .from('ig_contacts')
    .update(patch)
    .eq('id', contact.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as IgContactRow;
}
