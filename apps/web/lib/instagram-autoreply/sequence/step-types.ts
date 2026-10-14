import { z } from 'zod';

/**
 * Step configuration shared by the builder (client) and the sequence sender
 * (server). Branch targets reference a step's `key`, not its position, so
 * reordering steps never breaks a branch.
 */

export const IG_STEP_TYPES = [
  'text',
  'audio',
  'image',
  'video',
  'pdf',
  'delay',
  'quick_replies',
  'buttons',
  'collect_data',
  'tag',
  'condition',
  'handoff',
] as const;

export type IgStepType = (typeof IG_STEP_TYPES)[number];

export const IG_MEDIA_STEP_TYPES = ['audio', 'image', 'video', 'pdf'] as const;
export type IgMediaStepType = (typeof IG_MEDIA_STEP_TYPES)[number];

export const IG_TRIGGER_TYPES = [
  'comment_keyword',
  'story_reply',
  'story_mention',
  'dm_keyword',
  'first_message',
  'ice_breaker',
  'menu_payload',
] as const;

export type IgTriggerType = (typeof IG_TRIGGER_TYPES)[number];

/** Branch target: another step's key, '__end' to finish, or null for the next step. */
export const IG_GOTO_END = '__end';

const gotoSchema = z.string().trim().max(64).nullable().optional();
const keySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_-]{1,32}$/i)
  .optional();

const customFieldKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, 'Use lowercase letters, numbers and _');

export const IG_TEXT_MAX = 1000;
export const IG_BUTTON_TEXT_MAX = 640;
export const IG_LABEL_MAX = 20;
export const IG_DELAY_MAX_MINUTES = 23 * 60;

export const textStepConfigSchema = z.object({
  key: keySchema,
  text: z.string().trim().min(1).max(IG_TEXT_MAX),
});

export const mediaStepConfigSchema = z.object({
  key: keySchema,
  caption: z.string().trim().max(IG_TEXT_MAX).optional(),
});

export const delayStepConfigSchema = z.object({
  key: keySchema,
  minutes: z.number().int().min(1).max(IG_DELAY_MAX_MINUTES),
});

export const quickRepliesStepConfigSchema = z.object({
  key: keySchema,
  text: z.string().trim().min(1).max(IG_TEXT_MAX),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(IG_LABEL_MAX),
        goto: gotoSchema,
      }),
    )
    .min(1)
    .max(13),
});

export const buttonsStepConfigSchema = z.object({
  key: keySchema,
  text: z.string().trim().min(1).max(IG_BUTTON_TEXT_MAX),
  buttons: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(IG_LABEL_MAX),
        type: z.enum(['postback', 'url']),
        url: z.string().url().optional(),
        goto: gotoSchema,
      }),
    )
    .min(1)
    .max(3),
});

export const IG_COLLECT_FIELDS = [
  'email',
  'phone',
  'name',
  'text',
  'consent',
] as const;
export type IgCollectField = (typeof IG_COLLECT_FIELDS)[number];

export const collectDataStepConfigSchema = z.object({
  key: keySchema,
  prompt: z.string().trim().min(1).max(IG_TEXT_MAX),
  field: z.enum(IG_COLLECT_FIELDS),
  custom_field_key: customFieldKeySchema.optional(),
  retry_prompt: z.string().trim().max(IG_TEXT_MAX).optional(),
  max_retries: z.number().int().min(0).max(5).default(2),
  consent_purpose: z.string().trim().max(200).optional(),
  sync_to_crm: z.boolean().default(false),
  create_deal: z.boolean().default(false),
  deal_stage: z.string().trim().max(60).optional(),
  create_task: z.boolean().default(false),
});

export const tagStepConfigSchema = z.object({
  key: keySchema,
  add: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  remove: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const conditionStepConfigSchema = z.object({
  key: keySchema,
  check: z.enum(['has_tag', 'is_follower', 'field_set', 'field_equals']),
  tag: z.string().trim().max(40).optional(),
  field: z.string().trim().max(40).optional(),
  value: z.string().trim().max(200).optional(),
  then_goto: gotoSchema,
  else_goto: gotoSchema,
});

export const handoffStepConfigSchema = z.object({
  key: keySchema,
  text: z.string().trim().max(IG_TEXT_MAX).optional(),
});

export const IG_STEP_CONFIG_SCHEMAS = {
  text: textStepConfigSchema,
  audio: mediaStepConfigSchema,
  image: mediaStepConfigSchema,
  video: mediaStepConfigSchema,
  pdf: mediaStepConfigSchema,
  delay: delayStepConfigSchema,
  quick_replies: quickRepliesStepConfigSchema,
  buttons: buttonsStepConfigSchema,
  collect_data: collectDataStepConfigSchema,
  tag: tagStepConfigSchema,
  condition: conditionStepConfigSchema,
  handoff: handoffStepConfigSchema,
} as const satisfies Record<IgStepType, z.ZodTypeAny>;

export type IgStepConfigMap = {
  [K in IgStepType]: z.infer<(typeof IG_STEP_CONFIG_SCHEMAS)[K]>;
};

export type IgStep = {
  [K in IgStepType]: {
    step_type: K;
    config: IgStepConfigMap[K];
    asset_id: string | null;
  };
}[IgStepType];

export const igStepInputSchema = z
  .object({
    step_type: z.enum(IG_STEP_TYPES),
    config: z.record(z.unknown()),
    asset_id: z.string().uuid().nullable().optional(),
  })
  .transform((value, ctx) => {
    const schema = IG_STEP_CONFIG_SCHEMAS[value.step_type];
    const parsed = schema.safeParse(value.config);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ ...issue, path: ['config', ...issue.path] });
      }
      return z.NEVER;
    }
    return {
      step_type: value.step_type,
      config: parsed.data,
      asset_id: value.asset_id ?? null,
    } as IgStep;
  });

/** Parse a stored step row; returns null if the stored config is invalid. */
export function parseStoredStep(row: {
  step_type: string;
  config: unknown;
  asset_id: string | null;
}): IgStep | null {
  const parsed = igStepInputSchema.safeParse({
    step_type: row.step_type,
    config: row.config ?? {},
    asset_id: row.asset_id,
  });
  return parsed.success ? parsed.data : null;
}

export function isMediaStep(
  step: Pick<IgStep, 'step_type'>,
): step is Extract<IgStep, { step_type: IgMediaStepType }> {
  return (IG_MEDIA_STEP_TYPES as readonly string[]).includes(step.step_type);
}

/** Steps that send a message to the user (as opposed to logic-only steps). */
export function isMessageStep(step: Pick<IgStep, 'step_type'>): boolean {
  return !['delay', 'tag', 'condition'].includes(step.step_type);
}

/** Triggers whose first message must go out as a Private Reply to a comment. */
export function triggerStartsWithPrivateReply(triggerType: IgTriggerType) {
  return triggerType === 'comment_keyword';
}

export type IgSequenceIssue = { index: number | null; message: string };

/** Structural validation shared by the builder and the save action. */
export function validateIgSequence(
  steps: IgStep[],
  options: { triggerType: IgTriggerType },
): IgSequenceIssue[] {
  const issues: IgSequenceIssue[] = [];
  if (steps.length === 0) {
    issues.push({ index: null, message: 'Add at least one step.' });
    return issues;
  }
  if (steps.length > 30) {
    issues.push({
      index: null,
      message: 'A sequence can have up to 30 steps.',
    });
  }

  const keys = new Set<string>();
  steps.forEach((step, index) => {
    const key = step.config.key;
    if (key) {
      if (keys.has(key)) {
        issues.push({ index, message: `Duplicate step key "${key}".` });
      }
      keys.add(key);
    }
  });

  const checkGoto = (index: number, target: string | null | undefined) => {
    if (!target || target === IG_GOTO_END) return;
    if (!keys.has(target)) {
      issues.push({ index, message: 'A branch points to a missing step.' });
    }
  };

  if (triggerStartsWithPrivateReply(options.triggerType)) {
    const firstMessageIndex = steps.findIndex((s) => isMessageStep(s));
    const first = steps[firstMessageIndex];
    if (first && (isMediaStep(first) || first.step_type === 'handoff')) {
      issues.push({
        index: firstMessageIndex,
        message:
          'The first message to a commenter is a Private Reply and cannot contain media. Start with text, quick replies or buttons (e.g. "Send it 🎧"), then add the voice note after.',
      });
    }
    const delayBefore = steps
      .slice(0, Math.max(0, firstMessageIndex))
      .some((s) => s.step_type === 'delay');
    if (delayBefore) {
      issues.push({
        index: firstMessageIndex,
        message: 'Send the first reply straight away, before any delay.',
      });
    }
  }

  steps.forEach((step, index) => {
    const isLast = index === steps.length - 1;

    if (isMediaStep(step) && !step.asset_id) {
      issues.push({ index, message: 'Choose a file for this step.' });
    }

    if (step.step_type === 'buttons') {
      for (const button of step.config.buttons) {
        if (button.type === 'url' && !button.url) {
          issues.push({ index, message: 'Link buttons need a URL.' });
        }
        if (button.type === 'postback') checkGoto(index, button.goto);
      }
      const postbacks = step.config.buttons.filter(
        (b) => b.type === 'postback',
      );
      if (isLast && postbacks.some((b) => !b.goto)) {
        issues.push({
          index,
          message:
            'Add a step after this one, or choose where each button goes.',
        });
      }
    }

    if (step.step_type === 'quick_replies') {
      for (const option of step.config.options) checkGoto(index, option.goto);
      if (isLast && step.config.options.some((o) => !o.goto)) {
        issues.push({
          index,
          message:
            'Add a step after the quick replies, or choose where each reply goes.',
        });
      }
    }

    if (step.step_type === 'condition') {
      checkGoto(index, step.config.then_goto);
      checkGoto(index, step.config.else_goto);
      if (step.config.check === 'has_tag' && !step.config.tag) {
        issues.push({ index, message: 'Choose a tag to check.' });
      }
      if (
        (step.config.check === 'field_set' ||
          step.config.check === 'field_equals') &&
        !step.config.field
      ) {
        issues.push({ index, message: 'Choose a field to check.' });
      }
    }

    if (step.step_type === 'tag') {
      if (step.config.add.length === 0 && step.config.remove.length === 0) {
        issues.push({ index, message: 'Add or remove at least one tag.' });
      }
    }

    if (step.step_type === 'delay' && isLast) {
      issues.push({ index, message: 'A delay cannot be the last step.' });
    }
  });

  return issues;
}

/** Resolve a branch target to a position. null → next step, '__end' → past the end. */
export function resolveGoto(
  steps: Array<{ config: { key?: string } }>,
  currentIndex: number,
  target: string | null | undefined,
): number {
  if (!target) return currentIndex + 1;
  if (target === IG_GOTO_END) return steps.length;
  const index = steps.findIndex((s) => s.config.key === target);
  return index >= 0 ? index : currentIndex + 1;
}
