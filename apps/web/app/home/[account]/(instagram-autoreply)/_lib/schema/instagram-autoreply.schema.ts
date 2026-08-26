import { z } from 'zod';

import { assertSafeTriggerRegex } from '~/lib/instagram-autoreply/match-trigger';
import { igDmFlowConfigSchema } from '~/lib/instagram-autoreply/dm-flow-types';

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

export const deleteIgTriggerActionSchema = z.object({
  accountId: z.string().uuid(),
  triggerId: z.string().uuid(),
});

export const toggleIgTriggerActionSchema = z.object({
  accountId: z.string().uuid(),
  triggerId: z.string().uuid(),
  is_active: z.boolean(),
});
