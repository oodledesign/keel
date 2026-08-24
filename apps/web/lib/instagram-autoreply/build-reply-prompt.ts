import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { loadVoicePromptBlock } from '~/lib/voice/load-voice-prompt-block';

import {
  DEFAULT_IG_VOICE_SETTINGS,
  type IgVoiceSettings,
  parseIgVoiceSettings,
} from './types';

export function resolveIgVoiceSettings(
  accountDefault: unknown,
  triggerOverride: unknown | null | undefined,
): IgVoiceSettings {
  if (triggerOverride) {
    return parseIgVoiceSettings(triggerOverride);
  }
  return parseIgVoiceSettings(accountDefault ?? DEFAULT_IG_VOICE_SETTINGS);
}

function toneDescription(tone: IgVoiceSettings['tone']): string {
  switch (tone) {
    case 'professional':
      return 'Professional and polished';
    case 'casual':
      return 'Casual and conversational';
    case 'playful':
      return 'Playful and upbeat';
    default:
      return 'Friendly and warm';
  }
}

function emojiGuidance(settings: IgVoiceSettings): string {
  switch (settings.emoji_usage) {
    case 'none':
      return 'Do not use emojis.';
    case 'heavy':
      return 'Use emojis generously where natural.';
    default:
      if (settings.preferred_emojis.length > 0) {
        return `Use emojis lightly; prefer: ${settings.preferred_emojis.join(' ')}`;
      }
      return 'Use emojis sparingly (at most one per reply).';
  }
}

export function buildIgVoiceSystemBlock(settings: IgVoiceSettings): string {
  const parts = [
    'You write short Instagram comment or DM replies on behalf of a business.',
    `Tone: ${toneDescription(settings.tone)}.`,
    emojiGuidance(settings),
    `Write in ${settings.language}.`,
    'Keep replies concise (1–3 sentences). No hashtags unless the comment used them.',
    'Do not mention that you are an AI.',
  ];

  if (settings.banned_words.length > 0) {
    parts.push(`Never use these words: ${settings.banned_words.join(', ')}.`);
  }

  const custom = settings.custom_instructions.trim();
  if (custom) {
    parts.push(`Additional instructions: ${custom.slice(0, 800)}`);
  }

  return parts.join('\n');
}

export async function buildInstagramReplyPrompts(input: {
  client: SupabaseClient;
  accountId: string;
  userId?: string | null;
  voiceSettings: IgVoiceSettings;
  commentText: string;
  commenterUsername?: string | null;
  channel: 'public_comment' | 'dm';
}): Promise<{ systemPrompt: string; userPrompt: string }> {
  const brand = await loadAccountBrandResolved(input.accountId);
  const voiceBlock = input.userId
    ? await loadVoicePromptBlock(input.client, {
        userId: input.userId,
        accountId: input.accountId,
        purpose: 'proposal',
      })
    : null;

  const contextLines = [
    buildIgVoiceSystemBlock(input.voiceSettings),
    voiceBlock ? `\nBrand voice reference:\n${voiceBlock}` : null,
    brand.website_url ? `Business website: ${brand.website_url}` : null,
    brand.contact_email ? `Contact email: ${brand.contact_email}` : null,
  ].filter(Boolean);

  const systemPrompt = contextLines.join('\n');

  const who = input.commenterUsername
    ? `@${input.commenterUsername}`
    : 'the commenter';

  const channelLabel =
    input.channel === 'dm'
      ? 'private Instagram DM'
      : 'public comment reply on Instagram';

  const userPrompt = [
    `Write a ${channelLabel} responding to this comment from ${who}:`,
    `"${input.commentText.trim().slice(0, 2000)}"`,
    'Reply with only the message text to send — no quotes or labels.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}
