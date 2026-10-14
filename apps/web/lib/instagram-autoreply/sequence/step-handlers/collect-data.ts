import 'server-only';

import { DEFAULT_RETRY_PROMPTS } from '../collect-validate';
import {
  type StepContext,
  type StepOutcome,
  halt,
  isSendSuccess,
} from '../engine-types';
import { buildRunPayload, renderTemplate } from '../payload';
import type { IgStepConfigMap } from '../step-types';

export const CONSENT_YES_LABEL = 'Yes, I agree';
export const CONSENT_NO_LABEL = 'No thanks';

/**
 * Ask for a value. On a re-ask (invalid answer) the retry prompt is used and
 * the retry count carried on the run's `awaiting` is kept.
 */
export async function handleCollectDataStep(
  ctx: StepContext,
  config: IgStepConfigMap['collect_data'],
): Promise<StepOutcome> {
  const awaiting = ctx.run.awaiting;
  const retries =
    awaiting?.kind === 'collect_data' && awaiting.position === ctx.position
      ? awaiting.retries
      : 0;

  const base =
    retries > 0
      ? config.retry_prompt || DEFAULT_RETRY_PROMPTS[config.field]
      : config.prompt;
  const text = renderTemplate(base, {
    username: ctx.contact.username,
    name: ctx.contact.display_name,
  });

  const outcome =
    config.field === 'consent'
      ? await ctx.send(
          {
            text,
            quick_replies: [CONSENT_YES_LABEL, CONSENT_NO_LABEL].map(
              (title, index) => ({
                content_type: 'text' as const,
                title,
                payload: buildRunPayload(ctx.run.id, ctx.position, index),
              }),
            ),
          },
          {
            suffix: '',
            body: `${text}\n[${CONSENT_YES_LABEL} | ${CONSENT_NO_LABEL}]`,
            stepType: 'collect_data',
          },
        )
      : await ctx.send(
          { text },
          { suffix: '', body: text, stepType: 'collect_data' },
        );

  if (!isSendSuccess(outcome)) return halt(outcome);

  return {
    kind: 'wait_reply',
    awaiting: { kind: 'collect_data', position: ctx.position, retries },
  };
}
