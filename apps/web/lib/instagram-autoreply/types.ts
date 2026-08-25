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
  facebook_page_id: string;
  access_token: string;
  token_expires_at: string | null;
  voice_settings: IgVoiceSettings;
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
