import 'server-only';

import {
  attachmentTypeForKind,
  getOrCreateMetaAttachmentId,
} from '../../audio/get-delivery-url';
import type { IgButton } from '../../graph-api';
import {
  type StepContext,
  type StepOutcome,
  halt,
  isSendSuccess,
} from '../engine-types';
import { buildRunPayload, renderTemplate } from '../payload';
import type { IgMediaStepType, IgStep, IgStepConfigMap } from '../step-types';

function vars(ctx: StepContext) {
  return {
    username: ctx.contact.username,
    name: ctx.contact.display_name,
  };
}

export async function handleTextStep(
  ctx: StepContext,
  config: IgStepConfigMap['text'],
): Promise<StepOutcome> {
  const text = renderTemplate(config.text, vars(ctx));
  const outcome = await ctx.send(
    { text },
    { suffix: '', body: text, stepType: 'text' },
  );
  return isSendSuccess(outcome) ? { kind: 'advance' } : halt(outcome);
}

export async function handleMediaStep(
  ctx: StepContext,
  step: Extract<IgStep, { step_type: IgMediaStepType }>,
): Promise<StepOutcome> {
  if (!step.asset_id) {
    return halt({ kind: 'failed', error: 'No file chosen for this step' });
  }

  if (step.config.caption) {
    const caption = renderTemplate(step.config.caption, vars(ctx));
    const captionOutcome = await ctx.send(
      { text: caption },
      { suffix: ':caption', body: caption, stepType: step.step_type },
    );
    if (!isSendSuccess(captionOutcome)) return halt(captionOutcome);
  }

  const { data: asset } = await ctx.admin
    .from('ig_automation_assets')
    .select(
      'id, account_id, kind, label, delivery_path, transcode_status, meta_attachment_ids',
    )
    .eq('id', step.asset_id)
    .eq('account_id', ctx.run.account_id)
    .maybeSingle();

  if (!asset) {
    return halt({
      kind: 'failed',
      error: 'The file for this step was deleted',
    });
  }

  let attachmentId: string;
  try {
    attachmentId = await getOrCreateMetaAttachmentId({
      admin: ctx.admin,
      asset,
      igAccountId: ctx.igAccount.id,
      igBusinessAccountId: ctx.igAccount.ig_business_account_id,
      accessToken: ctx.accessToken,
    });
  } catch (error) {
    return halt({ kind: 'retry', error });
  }

  const outcome = await ctx.send(
    {
      attachment: {
        type: attachmentTypeForKind(asset.kind),
        payload: { attachment_id: attachmentId },
      },
    },
    {
      suffix: ':media',
      body: `[${asset.kind}] ${asset.label}`,
      stepType: step.step_type,
    },
  );
  return isSendSuccess(outcome) ? { kind: 'advance' } : halt(outcome);
}

export async function handleQuickRepliesStep(
  ctx: StepContext,
  config: IgStepConfigMap['quick_replies'],
): Promise<StepOutcome> {
  const text = renderTemplate(config.text, vars(ctx));
  const outcome = await ctx.send(
    {
      text,
      quick_replies: config.options.map((option, index) => ({
        content_type: 'text' as const,
        title: option.label,
        payload: buildRunPayload(ctx.run.id, ctx.position, index),
      })),
    },
    {
      suffix: '',
      body: `${text}\n[${config.options.map((o) => o.label).join(' | ')}]`,
      stepType: 'quick_replies',
    },
  );
  if (!isSendSuccess(outcome)) return halt(outcome);
  return {
    kind: 'wait_reply',
    awaiting: { kind: 'quick_reply', position: ctx.position },
  };
}

export async function handleButtonsStep(
  ctx: StepContext,
  config: IgStepConfigMap['buttons'],
): Promise<StepOutcome> {
  const text = renderTemplate(config.text, vars(ctx));
  const buttons: IgButton[] = config.buttons.map((button, index) =>
    button.type === 'url'
      ? { type: 'web_url', title: button.label, url: button.url! }
      : {
          type: 'postback',
          title: button.label,
          payload: buildRunPayload(ctx.run.id, ctx.position, index),
        },
  );

  const outcome = await ctx.send(
    {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text, buttons },
      },
    },
    {
      suffix: '',
      body: `${text}\n[${config.buttons.map((b) => b.label).join(' | ')}]`,
      stepType: 'buttons',
    },
  );
  if (!isSendSuccess(outcome)) return halt(outcome);

  const waitsForTap = config.buttons.some((b) => b.type === 'postback');
  return waitsForTap
    ? {
        kind: 'wait_reply',
        awaiting: { kind: 'button', position: ctx.position },
      }
    : { kind: 'advance' };
}

export async function handleHandoffStep(
  ctx: StepContext,
  config: IgStepConfigMap['handoff'],
): Promise<StepOutcome> {
  if (config.text) {
    const text = renderTemplate(config.text, vars(ctx));
    const outcome = await ctx.send(
      { text },
      { suffix: '', body: text, stepType: 'handoff' },
    );
    if (!isSendSuccess(outcome)) return halt(outcome);
  }
  return { kind: 'handoff' };
}
