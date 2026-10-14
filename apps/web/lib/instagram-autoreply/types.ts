import type { Json } from '../database.types';
import type { IgDmFlowConfig } from './dm-flow-types';
import type { IgTriggerType } from './sequence/step-types';

export type IgVoiceSettings = {
  tone: 'friendly' | 'professional' | 'casual' | 'playful';
  emoji_usage: 'none' | 'light' | 'heavy';
  preferred_emojis: string[];
  banned_words: string[];
  custom_instructions: string;
  language: string;
};

export const DEFAULT_IG_VOICE_SETTINGS: IgVoiceSettings = {
  tone: 'friendly',
  emoji_usage: 'light',
  preferred_emojis: [],
  banned_words: [],
  custom_instructions: '',
  language: 'en-GB',
};

export type IgMatchType = 'contains' | 'exact' | 'regex';
export type IgScope = 'all_posts' | 'specific_posts';
export type IgReplyMode = 'static' | 'ai_generated';
export type IgAiTier = 'standard' | 'enhanced';

export type IgConnectedAccountRow = {
  id: string;
  account_id: string;
  ig_business_account_id: string;
  ig_username: string | null;
  facebook_page_id: string | null;
  access_token: string;
  token_expires_at: string | null;
  voice_settings: IgVoiceSettings;
  /** Parse with `parseIgMessengerProfile`. */
  messenger_profile: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IgTriggerRow = {
  id: string;
  ig_account_id: string;
  account_id: string;
  name: string;
  keywords: string[];
  match_type: IgMatchType;
  scope: IgScope;
  target_media_ids: string[] | null;
  public_reply_enabled: boolean;
  public_reply_mode: IgReplyMode;
  public_reply_template: string | null;
  public_reply_ai_tier: IgAiTier | null;
  dm_enabled: boolean;
  dm_mode: IgReplyMode;
  dm_template: string | null;
  dm_ai_tier: IgAiTier | null;
  dm_flow: IgDmFlowConfig | null;
  voice_settings_override: IgVoiceSettings | null;
  create_deal_on_match: boolean;
  deal_stage: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IgCommentEventRow = {
  id: string;
  ig_account_id: string;
  account_id: string;
  comment_id: string;
  media_id: string | null;
  commenter_username: string | null;
  commenter_ig_id: string | null;
  comment_text: string | null;
  matched_trigger_id: string | null;
  public_reply_status: 'pending' | 'sent' | 'skipped' | 'failed' | null;
  public_reply_sent_at: string | null;
  public_reply_content: string | null;
  public_reply_ai_credits_spent: number | null;
  dm_status:
    | 'pending'
    | 'sent'
    | 'skipped'
    | 'failed'
    | 'window_expired'
    | null;
  dm_sent_at: string | null;
  dm_content: string | null;
  dm_ai_credits_spent: number | null;
  pipeline_deal_id: string | null;
  error_message: string | null;
  created_at: string;
};

export type IgDmSessionRow = {
  id: string;
  ig_account_id: string;
  account_id: string;
  trigger_id: string;
  comment_event_id: string | null;
  commenter_ig_id: string;
  current_step_id: string;
  status: 'active' | 'completed';
  created_at: string;
  updated_at: string;
};

export type IgTriggerV2Fields = {
  trigger_type: IgTriggerType;
  match_mode: 'contains' | 'exact' | 'any';
  media_scope: 'any_post' | 'specific_post' | 'reels' | 'stories';
  media_id: string | null;
  require_follow: boolean;
  once_per_contact: boolean;
  cooldown_minutes: number | null;
  entry_payload: string | null;
};

export type IgTriggerFullRow = IgTriggerRow & IgTriggerV2Fields;

export type IgContactConsentRecord = {
  purpose: string;
  wording: string;
  granted: boolean;
  recorded_at: string;
  source_message_id: string | null;
};

export type IgContactRow = {
  id: string;
  account_id: string;
  ig_account_id: string;
  igsid: string;
  username: string | null;
  display_name: string | null;
  last_inbound_at: string | null;
  opted_out_at: string | null;
  tags: string[];
  custom_fields: Record<string, string>;
  linked_client_id: string | null;
  is_follower: boolean | null;
  is_follower_checked_at: string | null;
  handoff_at: string | null;
  consent: IgContactConsentRecord[];
  created_at: string;
  updated_at: string;
};

export type IgRunStatus =
  | 'active'
  | 'waiting_delay'
  | 'waiting_reply'
  | 'completed'
  | 'handed_off'
  | 'stopped'
  | 'failed'
  | 'window_expired';

export type IgRunSource =
  | 'comment'
  | 'message'
  | 'postback'
  | 'story_reply'
  | 'story_mention'
  | 'ice_breaker'
  | 'menu'
  | 'test';

export type IgRunAwaiting =
  | { kind: 'quick_reply'; position: number }
  | { kind: 'button'; position: number }
  | { kind: 'any_reply'; position: number }
  | { kind: 'follow'; position: number }
  | { kind: 'collect_data'; position: number; retries: number };

export type IgRunRow = {
  id: string;
  account_id: string;
  ig_account_id: string;
  contact_id: string;
  trigger_id: string;
  source: IgRunSource;
  source_event_id: string;
  source_comment_id: string | null;
  private_reply_used: boolean;
  follow_gate_passed: boolean;
  current_position: number;
  status: IgRunStatus;
  awaiting: IgRunAwaiting | null;
  next_step_at: string | null;
  attempts: number;
  steps_executed: number;
  locked_until: string | null;
  last_error: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IgStepRow = {
  id: string;
  account_id: string;
  trigger_id: string;
  position: number;
  step_type: string;
  config: unknown;
  asset_id: string | null;
};

export function parseIgVoiceSettings(value: unknown): IgVoiceSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_IG_VOICE_SETTINGS };
  }
  const row = value as Record<string, unknown>;
  const tone = row.tone;
  const emojiUsage = row.emoji_usage;
  return {
    tone:
      tone === 'professional' ||
      tone === 'casual' ||
      tone === 'playful' ||
      tone === 'friendly'
        ? tone
        : DEFAULT_IG_VOICE_SETTINGS.tone,
    emoji_usage:
      emojiUsage === 'none' || emojiUsage === 'heavy' || emojiUsage === 'light'
        ? emojiUsage
        : DEFAULT_IG_VOICE_SETTINGS.emoji_usage,
    preferred_emojis: Array.isArray(row.preferred_emojis)
      ? row.preferred_emojis.filter((e): e is string => typeof e === 'string')
      : [],
    banned_words: Array.isArray(row.banned_words)
      ? row.banned_words.filter((e): e is string => typeof e === 'string')
      : [],
    custom_instructions:
      typeof row.custom_instructions === 'string'
        ? row.custom_instructions
        : '',
    language:
      typeof row.language === 'string' && row.language.trim()
        ? row.language.trim()
        : DEFAULT_IG_VOICE_SETTINGS.language,
  };
}
