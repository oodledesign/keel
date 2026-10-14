import { z } from 'zod';

import { igDmFlowConfigSchema } from '~/lib/instagram-autoreply/dm-flow-types';
import { assertSafeTriggerRegex } from '~/lib/instagram-autoreply/match-trigger';
import {
  IG_TRIGGER_TYPES,
  igStepInputSchema,
  validateIgSequence,
} from '~/lib/instagram-autoreply/sequence/step-types';

const voiceSettingsSchema = z.object({
  tone: z.enum(['friendly', 'professional', 'casual', 'playful']),
  emoji_usage: z.enum(['none', 'light', 'heavy']),
  preferred_emojis: z.array(z.string()).default([]),
  banned_words: z.array(z.string()).default([]),
  custom_instructions: z.string().max(2000).default(''),
  language: z.string().min(2).max(16).default('en-GB'),
});

export const updateIgVoiceSettingsActionSchema = z.object({
  accountId: z.string().uuid(),
  voiceSettings: voiceSettingsSchema,
});

export const disconnectIgAccountActionSchema = z.object({
  accountId: z.string().uuid(),
});

export const previewIgReplyActionSchema = z.object({
  accountId: z.string().uuid(),
  sampleComment: z.string().min(1).max(2000),
  voiceSettings: voiceSettingsSchema.optional(),
});

export const upsertIgTriggerActionSchema = z
  .object({
    accountId: z.string().uuid(),
    triggerId: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    keywords: z.array(z.string().min(1)).min(1).max(50),
    match_type: z.enum(['contains', 'exact', 'regex']).default('contains'),
    scope: z.enum(['all_posts', 'specific_posts']).default('all_posts'),
    target_media_ids: z.array(z.string()).optional(),
    public_reply_enabled: z.boolean().default(true),
    public_reply_mode: z.enum(['static', 'ai_generated']).default('static'),
    public_reply_template: z.string().max(2000).nullable().optional(),
    public_reply_ai_tier: z.enum(['standard', 'enhanced']).default('standard'),
    dm_enabled: z.boolean().default(true),
    dm_mode: z.enum(['static', 'ai_generated']).default('static'),
    dm_template: z.string().max(2000).nullable().optional(),
    dm_ai_tier: z.enum(['standard', 'enhanced']).default('standard'),
    dm_use_flow: z.boolean().default(false),
    dm_flow: igDmFlowConfigSchema.nullable().optional(),
    voice_settings_override: voiceSettingsSchema.nullable().optional(),
    create_deal_on_match: z.boolean().default(false),
    deal_stage: z.string().default('lead'),
    is_active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.dm_enabled && data.dm_use_flow && !data.dm_flow) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Interactive DM flow requires at least one step',
        path: ['dm_flow'],
      });
    }
    if (data.match_type !== 'regex') return;
    for (const keyword of data.keywords) {
      try {
        assertSafeTriggerRegex(keyword);
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            error instanceof Error ? error.message : 'Unsafe regex pattern',
          path: ['keywords'],
        });
        return;
      }
    }
  });

export const IG_KEYWORD_TRIGGER_TYPES = [
  'comment_keyword',
  'dm_keyword',
] as const;

/** Trigger + sequence saved together by the automation builder. */
export const saveIgAutomationActionSchema = z
  .object({
    accountId: z.string().uuid(),
    triggerId: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'Give the automation a name').max(120),
    trigger_type: z.enum(IG_TRIGGER_TYPES),
    keywords: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    match_mode: z.enum(['contains', 'exact', 'any']).default('contains'),
    /** Keeps an existing regex trigger matching as a pattern. */
    use_regex: z.boolean().default(false),
    media_scope: z
      .enum(['any_post', 'specific_post', 'reels', 'stories'])
      .default('any_post'),
    media_id: z.string().trim().max(64).nullable().optional(),
    require_follow: z.boolean().default(false),
    once_per_contact: z.boolean().default(false),
    cooldown_minutes: z.number().int().min(0).max(43200).nullable().optional(),
    public_reply_enabled: z.boolean().default(false),
    public_reply_mode: z.enum(['static', 'ai_generated']).default('static'),
    public_reply_template: z.string().max(2000).nullable().optional(),
    public_reply_ai_tier: z.enum(['standard', 'enhanced']).default('standard'),
    create_deal_on_match: z.boolean().default(false),
    deal_stage: z.string().default('lead'),
    is_active: z.boolean().default(true),
    steps: z.array(igStepInputSchema).max(30),
  })
  .superRefine((data, ctx) => {
    const needsKeywords =
      (IG_KEYWORD_TRIGGER_TYPES as readonly string[]).includes(
        data.trigger_type,
      ) && data.match_mode !== 'any';
    if (needsKeywords && data.keywords.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one keyword, or choose "Any message".',
        path: ['keywords'],
      });
    }
    if (data.use_regex && data.match_mode !== 'any') {
      for (const keyword of data.keywords) {
        try {
          assertSafeTriggerRegex(keyword);
        } catch (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              error instanceof Error ? error.message : 'Unsafe regex pattern',
            path: ['keywords'],
          });
          break;
        }
      }
    }
    if (data.media_scope === 'specific_post' && !data.media_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose a post.',
        path: ['media_id'],
      });
    }
    for (const issue of validateIgSequence(data.steps, {
      triggerType: data.trigger_type,
    })) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          issue.index === null
            ? issue.message
            : `Step ${issue.index + 1}: ${issue.message}`,
        path: issue.index === null ? ['steps'] : ['steps', issue.index],
      });
    }
  });

export type SaveIgAutomationInput = z.input<
  typeof saveIgAutomationActionSchema
>;

export const sendIgTestRunActionSchema = z.object({
  accountId: z.string().uuid(),
  triggerId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export const deleteIgTriggerActionSchema = z.object({
  accountId: z.string().uuid(),
  triggerId: z.string().uuid(),
});

export const toggleIgTriggerActionSchema = z.object({
  accountId: z.string().uuid(),
  triggerId: z.string().uuid(),
  is_active: z.boolean(),
});

export const igContactActionSchema = z.object({
  accountId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export const sendIgAgentReplyActionSchema = igContactActionSchema.extend({
  text: z.string().trim().min(1, 'Write a message').max(1000),
  /** One per drafted message, so a double-submit or retry sends once. */
  nonce: z.string().uuid(),
});
