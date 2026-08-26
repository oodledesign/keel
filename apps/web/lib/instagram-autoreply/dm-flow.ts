import 'server-only';

import type { IgDmFlowConfig, IgDmFlowStep } from './dm-flow-types';
import {
  buildPostbackPayload,
  getFlowEntryStep,
  getNextFlowStep,
  parseIgDmFlow,
} from './dm-flow-types';
import {
  postPrivateCommentButtonTemplate,
  sendDirectButtonTemplate,
} from './graph-api';
import type { IgTriggerRow } from './types';

export function triggerUsesInteractiveDm(trigger: IgTriggerRow): boolean {
  if (!trigger.dm_enabled) return false;
  const flow = parseIgDmFlow(trigger.dm_flow);
  return flow !== null && flow.steps.length > 0;
}

export function buildStepButtons(
  step: IgDmFlowStep,
  triggerId: string,
): Array<
  | { type: 'postback'; title: string; payload: string }
  | { type: 'web_url'; title: string; url: string }
> {
  return step.buttons.map((btn) => {
    if (btn.type === 'url') {
      return { type: 'web_url' as const, title: btn.label, url: btn.url! };
    }
    return {
      type: 'postback' as const,
      title: btn.label,
      payload: buildPostbackPayload(triggerId, step.id),
    };
  });
}

export async function sendFlowStepToComment(params: {
  igBusinessAccountId: string;
  commentId: string;
  accessToken: string;
  triggerId: string;
  step: IgDmFlowStep;
}): Promise<void> {
  await postPrivateCommentButtonTemplate(
    params.igBusinessAccountId,
    params.commentId,
    params.step.message,
    buildStepButtons(params.step, params.triggerId),
    params.accessToken,
  );
}

export async function sendFlowStepToUser(params: {
  igBusinessAccountId: string;
  recipientIgId: string;
  accessToken: string;
  triggerId: string;
  step: IgDmFlowStep;
}): Promise<void> {
  await sendDirectButtonTemplate(
    params.igBusinessAccountId,
    params.recipientIgId,
    params.step.message,
    buildStepButtons(params.step, params.triggerId),
    params.accessToken,
  );
}

export function getEntryStepForTrigger(
  trigger: IgTriggerRow,
): IgDmFlowStep | null {
  const flow = parseIgDmFlow(trigger.dm_flow);
  if (!flow) return null;
  return getFlowEntryStep(flow);
}

export function getNextStepForPostback(
  flow: IgDmFlowConfig,
  fromStepId: string,
): IgDmFlowStep | null {
  return getNextFlowStep(flow, fromStepId);
}
