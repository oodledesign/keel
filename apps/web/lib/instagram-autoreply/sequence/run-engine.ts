import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type IgOutgoingMessage,
  isDmWindowExpiredError,
  isTransientGraphError,
  redactUrls,
  sendIgMessage,
  sendTypingIndicator,
} from '../graph-api';
import { decryptIgToken } from '../token-crypto';
import type {
  IgConnectedAccountRow,
  IgContactRow,
  IgRunAwaiting,
  IgRunRow,
  IgRunStatus,
  IgStepRow,
  IgTriggerFullRow,
} from '../types';
import { loadIgContact } from './contacts';
import type {
  HaltOutcome,
  SendOptions,
  SendOutcome,
  StepContext,
} from './engine-types';
import { getFollowerStatus } from './follower';
import {
  type IgPlanSendBudget,
  checkHourlySendCap,
  loadIgPlanSendBudget,
} from './guards';
import {
  claimOutboundSend,
  markOutboundFailed,
  markOutboundSent,
} from './message-events';
import { buildFollowCheckPayload } from './payload';
import { executeStep } from './step-handlers';
import { type IgStep, parseStoredStep } from './step-types';
import { chooseRecipient, nextRetryAt } from './window';

const TERMINAL_STATUSES: IgRunStatus[] = [
  'completed',
  'handed_off',
  'stopped',
  'failed',
  'window_expired',
];

/** Guards against branch loops executing forever within one pass. */
const MAX_STEPS_PER_PASS = 25;

export function isTerminalRunStatus(status: IgRunStatus) {
  return TERMINAL_STATUSES.includes(status);
}

export async function loadSequenceSteps(
  admin: SupabaseClient,
  triggerId: string,
): Promise<{ steps: IgStep[]; invalid: boolean }> {
  const { data, error } = await admin
    .from('ig_automation_steps')
    .select('id, account_id, trigger_id, position, step_type, config, asset_id')
    .eq('trigger_id', triggerId)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as IgStepRow[];
  const steps: IgStep[] = [];
  let invalid = false;
  for (const row of rows) {
    const step = parseStoredStep(row);
    if (step) steps.push(step);
    else invalid = true;
  }
  return { steps, invalid };
}

function logError(message: string, meta: Record<string, unknown>) {
  console.error(`[ig-sequence] ${message}`, meta);
}

function errorText(error: unknown) {
  return redactUrls(error instanceof Error ? error.message : String(error));
}

/**
 * Advance a run as far as it can go right now. Safe to call concurrently and
 * repeatedly: a row lock stops two workers advancing the same run, and every
 * send is reserved by an idempotency key before it is made.
 */
export async function advanceRun(
  admin: SupabaseClient,
  runId: string,
  options: { lockHeld?: boolean } = {},
): Promise<void> {
  if (!options.lockHeld) {
    const { data: locked, error } = await admin.rpc('lock_ig_automation_run', {
      p_run_id: runId,
    });
    if (error || !locked) return;
  }

  try {
    await runPass(admin, runId);
  } catch (error) {
    logError('run pass failed', { runId, error: errorText(error) });
    await scheduleRetryAfterCrash(admin, runId, error);
  } finally {
    await admin
      .from('ig_automation_runs')
      .update({ locked_until: null })
      .eq('id', runId);
  }
}

async function scheduleRetryAfterCrash(
  admin: SupabaseClient,
  runId: string,
  error: unknown,
) {
  const { data: run } = await admin
    .from('ig_automation_runs')
    .select('attempts, status')
    .eq('id', runId)
    .maybeSingle();
  if (!run || isTerminalRunStatus(run.status as IgRunStatus)) return;

  const attempts = (run.attempts as number) + 1;
  const retryAt = nextRetryAt(attempts);
  await admin
    .from('ig_automation_runs')
    .update(
      retryAt
        ? {
            attempts,
            status: 'active',
            next_step_at: retryAt.toISOString(),
            last_error: errorText(error).slice(0, 500),
          }
        : {
            attempts,
            status: 'failed',
            completed_at: new Date().toISOString(),
            last_error: errorText(error).slice(0, 500),
          },
    )
    .eq('id', runId);
}

async function runPass(admin: SupabaseClient, runId: string) {
  const { data: runRow } = await admin
    .from('ig_automation_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();
  if (!runRow) return;
  const run = runRow as IgRunRow;

  if (isTerminalRunStatus(run.status) || run.status === 'waiting_reply') return;
  if (
    run.next_step_at &&
    Date.parse(run.next_step_at) > Date.now() &&
    run.status === 'waiting_delay'
  ) {
    return;
  }

  const persist = async (patch: Record<string, unknown>) => {
    const { error } = await admin
      .from('ig_automation_runs')
      .update(patch)
      .eq('id', run.id);
    if (error) throw new Error(error.message);
  };

  const finish = async (
    status: IgRunStatus,
    lastError: string | null,
    extra: Record<string, unknown> = {},
  ) => {
    await persist({
      status,
      last_error: lastError,
      completed_at: new Date().toISOString(),
      next_step_at: null,
      awaiting: null,
      ...extra,
    });
  };

  const [{ data: trigger }, { data: igAccount }, contact] = await Promise.all([
    admin
      .from('ig_triggers')
      .select('*')
      .eq('id', run.trigger_id)
      .maybeSingle(),
    admin
      .from('ig_connected_accounts')
      .select('*')
      .eq('id', run.ig_account_id)
      .maybeSingle(),
    loadIgContact(admin, run.contact_id),
  ]);

  if (!contact) return;
  if (!trigger || !(trigger as IgTriggerFullRow).is_active) {
    return finish('stopped', 'Automation turned off');
  }
  if (!igAccount || !(igAccount as IgConnectedAccountRow).is_active) {
    return finish('stopped', 'Instagram account disconnected');
  }

  const { steps, invalid } = await loadSequenceSteps(admin, run.trigger_id);
  if (invalid) {
    return finish('failed', 'A step in this automation is misconfigured');
  }

  let accessToken: string;
  try {
    accessToken = decryptIgToken(
      (igAccount as IgConnectedAccountRow).access_token,
    );
  } catch {
    return finish('failed', 'Could not decrypt the Instagram access token');
  }

  const account = igAccount as IgConnectedAccountRow;
  const automation = trigger as IgTriggerFullRow;
  const state = {
    position: run.current_position,
    stepsExecuted: run.steps_executed,
    privateReplyUsed: run.private_reply_used,
    contact: contact as IgContactRow,
    awaiting: run.awaiting as IgRunAwaiting | null,
  };

  const eventCtx = () => ({
    accountId: run.account_id,
    igAccountId: run.ig_account_id,
    contactId: state.contact.id,
    runId: run.id,
    triggerId: run.trigger_id,
  });

  let planBudget: IgPlanSendBudget | undefined;

  const send = async (
    message: IgOutgoingMessage,
    opts: SendOptions,
  ): Promise<SendOutcome> => {
    const recipient = chooseRecipient({
      lastInboundAt: state.contact.last_inbound_at,
      sourceCommentId: run.source_comment_id,
      privateReplyUsed: state.privateReplyUsed,
      runCreatedAt: run.created_at,
    });

    if (recipient.kind === 'closed') {
      const noReplySinceStart =
        !state.contact.last_inbound_at ||
        Date.parse(state.contact.last_inbound_at) < Date.parse(run.created_at);
      if (
        run.source_comment_id &&
        state.privateReplyUsed &&
        noReplySinceStart
      ) {
        return { kind: 'wait_any_reply' };
      }
      return { kind: 'window_closed' };
    }

    const isMedia =
      'attachment' in message && message.attachment.type !== 'template';
    if (recipient.kind === 'private_reply' && isMedia) {
      return {
        kind: 'failed',
        error:
          'Private replies cannot contain media. Start the sequence with text or a button.',
      };
    }

    // Capped plans re-count before every send so concurrent runs for the
    // same account see each other's in-flight sends.
    if (!planBudget?.ok || planBudget.remainingThisMonth !== null) {
      planBudget = await loadIgPlanSendBudget(admin, run.account_id);
    }
    if (!planBudget.ok)
      return { kind: 'plan_limit', reason: planBudget.reason };
    if (
      planBudget.remainingThisMonth !== null &&
      planBudget.remainingThisMonth <= 0
    ) {
      return {
        kind: 'plan_limit',
        reason: 'Monthly Instagram send limit reached',
      };
    }

    const cap = await checkHourlySendCap(
      admin,
      run.ig_account_id,
      new Date(),
      planBudget.hourlyCap,
    );
    if (!cap.ok) return { kind: 'deferred', until: cap.retryAt };

    const claim = await claimOutboundSend(admin, eventCtx(), {
      idempotencyKey: `run:${run.id}:exec:${state.stepsExecuted}${opts.suffix}`,
      eventType: recipient.kind === 'private_reply' ? 'private_reply' : 'step',
      stepPosition: state.position,
      stepType: opts.stepType,
      body: opts.body,
    });

    if (claim.kind === 'in_flight') return { kind: 'in_flight' };
    if (claim.kind === 'already_sent' || claim.kind === 'unknown_outcome') {
      if (recipient.kind === 'private_reply' && !state.privateReplyUsed) {
        state.privateReplyUsed = true;
        await persist({ private_reply_used: true });
      }
      return { kind: 'duplicate' };
    }

    if (recipient.kind === 'direct') {
      await sendTypingIndicator(
        account.ig_business_account_id,
        state.contact.igsid,
        accessToken,
      ).catch(() => undefined);
    }

    try {
      const result = await sendIgMessage(
        account.ig_business_account_id,
        accessToken,
        {
          recipient:
            recipient.kind === 'private_reply'
              ? { comment_id: recipient.commentId }
              : { id: state.contact.igsid },
          message,
        },
      );
      await markOutboundSent(admin, claim.eventId, result.messageId);
      if (recipient.kind === 'private_reply') {
        state.privateReplyUsed = true;
        await persist({ private_reply_used: true });
      }
      return { kind: 'sent' };
    } catch (error) {
      if (isDmWindowExpiredError(error)) {
        await markOutboundFailed(admin, claim.eventId, error, 'window_expired');
        if (recipient.kind === 'private_reply') {
          state.privateReplyUsed = true;
          await persist({ private_reply_used: true });
        }
        return { kind: 'window_closed' };
      }
      await markOutboundFailed(admin, claim.eventId, error, 'failed');
      if (isTransientGraphError(error)) return { kind: 'retry', error };
      return { kind: 'failed', error: errorText(error) };
    }
  };

  const handleHalt = async (outcome: HaltOutcome) => {
    switch (outcome.kind) {
      case 'wait_any_reply':
        return persist({
          status: 'waiting_reply',
          awaiting: { kind: 'any_reply', position: state.position },
          next_step_at: null,
        });
      case 'window_closed':
        return finish(
          'window_expired',
          'The 24-hour messaging window has closed',
        );
      case 'retry': {
        const attempts = run.attempts + 1;
        const retryAt = nextRetryAt(attempts);
        if (!retryAt) {
          return finish('failed', errorText(outcome.error).slice(0, 500), {
            attempts,
          });
        }
        return persist({
          status: 'active',
          attempts,
          next_step_at: retryAt.toISOString(),
          last_error: errorText(outcome.error).slice(0, 500),
        });
      }
      case 'failed':
        return finish('failed', outcome.error.slice(0, 500));
      case 'deferred':
        return persist({
          status: 'active',
          next_step_at: outcome.until.toISOString(),
          last_error: 'Hourly send limit reached; will continue shortly',
        });
      case 'plan_limit':
        return finish('stopped', outcome.reason.slice(0, 500));
      case 'in_flight':
        return;
    }
  };

  if (state.contact.opted_out_at) {
    return finish('stopped', 'Contact opted out');
  }

  // Follow gate: checked once per run before the first step.
  if (automation.require_follow && !run.follow_gate_passed) {
    const result = await getFollowerStatus(admin, {
      contact: state.contact,
      accessToken,
      force: state.awaiting?.kind === 'follow',
    });
    state.contact = result.contact;

    // Fail open when Meta does not report follow status.
    if (result.isFollower === false) {
      const handle = account.ig_username ? `@${account.ig_username}` : 'us';
      const text = `Please follow ${handle} first, then tap below and I'll send it straight over.`;
      const outcome = await send(
        {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text,
              buttons: [
                {
                  type: 'postback',
                  title: "I'm following",
                  payload: buildFollowCheckPayload(run.id),
                },
              ],
            },
          },
        },
        {
          suffix: ':follow',
          body: `${text}\n[I'm following]`,
          stepType: 'follow_gate',
        },
      );

      if (outcome.kind === 'sent' || outcome.kind === 'duplicate') {
        state.stepsExecuted += 1;
        return persist({
          status: 'waiting_reply',
          awaiting: { kind: 'follow', position: state.position },
          steps_executed: state.stepsExecuted,
          next_step_at: null,
        });
      }
      return handleHalt(outcome as HaltOutcome);
    }

    await persist({ follow_gate_passed: true });
  }

  for (let i = 0; i < MAX_STEPS_PER_PASS; i++) {
    if (state.contact.opted_out_at) {
      return finish('stopped', 'Contact opted out');
    }
    if (state.contact.handoff_at && run.source !== 'test') {
      return finish('handed_off', null);
    }
    if (state.position >= steps.length) {
      return finish('completed', null, { current_position: state.position });
    }

    const step = steps[state.position]!;
    const ctx: StepContext = {
      admin,
      run: { ...run, awaiting: state.awaiting },
      trigger: automation,
      igAccount: account,
      accessToken,
      steps,
      position: state.position,
      contact: state.contact,
      setContact: (next) => {
        state.contact = next;
      },
      send,
    };

    const outcome = await executeStep(ctx, step);
    state.awaiting = null;

    switch (outcome.kind) {
      case 'advance':
        state.stepsExecuted += 1;
        state.position = outcome.next ?? state.position + 1;
        await persist({
          current_position: state.position,
          steps_executed: state.stepsExecuted,
          status: 'active',
          attempts: 0,
          awaiting: null,
          next_step_at: null,
          last_error: null,
        });
        continue;

      case 'wait_delay':
        state.stepsExecuted += 1;
        return persist({
          current_position: state.position + 1,
          steps_executed: state.stepsExecuted,
          status: 'waiting_delay',
          next_step_at: outcome.until.toISOString(),
          attempts: 0,
          awaiting: null,
          last_error: null,
        });

      case 'wait_reply':
        state.stepsExecuted += 1;
        return persist({
          current_position: state.position,
          steps_executed: state.stepsExecuted,
          status: 'waiting_reply',
          awaiting: outcome.awaiting,
          next_step_at: null,
          attempts: 0,
          last_error: null,
        });

      case 'handoff':
        state.stepsExecuted += 1;
        await admin
          .from('ig_contacts')
          .update({ handoff_at: new Date().toISOString() })
          .eq('id', state.contact.id);
        return finish('handed_off', null, {
          current_position: state.position + 1,
          steps_executed: state.stepsExecuted,
        });

      case 'halt':
        return handleHalt(outcome.outcome);
    }
  }

  return finish(
    'failed',
    'Too many steps ran in one go. Check for a branch that loops back on itself.',
  );
}
