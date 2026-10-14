import type { SupabaseClient } from '@supabase/supabase-js';

import type { IgOutgoingMessage } from '../graph-api';
import type {
  IgConnectedAccountRow,
  IgContactRow,
  IgRunAwaiting,
  IgRunRow,
  IgTriggerFullRow,
} from '../types';
import type { IgStep } from './step-types';

export type SendOutcome =
  | { kind: 'sent' }
  | { kind: 'duplicate' }
  /** Private reply already used and the user has not written back yet. */
  | { kind: 'wait_any_reply' }
  | { kind: 'window_closed' }
  | { kind: 'retry'; error: unknown }
  | { kind: 'failed'; error: string }
  | { kind: 'deferred'; until: Date }
  /** Plan send limit reached for this month. */
  | { kind: 'plan_limit'; reason: string }
  | { kind: 'in_flight' };

export type HaltOutcome = Exclude<
  SendOutcome,
  { kind: 'sent' } | { kind: 'duplicate' }
>;

export type StepOutcome =
  | { kind: 'advance'; next?: number }
  | { kind: 'wait_delay'; until: Date }
  | { kind: 'wait_reply'; awaiting: IgRunAwaiting }
  | { kind: 'handoff' }
  | { kind: 'halt'; outcome: HaltOutcome };

export type SendOptions = {
  /** Distinguishes multiple sends within one step (e.g. caption + media). */
  suffix: string;
  /** Human-readable copy for the message log (never URLs or tokens). */
  body: string;
  stepType: string;
};

export type StepContext = {
  admin: SupabaseClient;
  run: IgRunRow;
  trigger: IgTriggerFullRow;
  igAccount: IgConnectedAccountRow;
  accessToken: string;
  steps: IgStep[];
  position: number;
  contact: IgContactRow;
  setContact: (contact: IgContactRow) => void;
  send: (
    message: IgOutgoingMessage,
    options: SendOptions,
  ) => Promise<SendOutcome>;
};

export function isSendSuccess(outcome: SendOutcome) {
  return outcome.kind === 'sent' || outcome.kind === 'duplicate';
}

export function halt(outcome: SendOutcome): StepOutcome {
  return { kind: 'halt', outcome: outcome as HaltOutcome };
}
