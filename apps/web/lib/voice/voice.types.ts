export type VoiceProfileKind = 'personal' | 'brand';
export type VoiceProfileStatus = 'draft' | 'ready' | 'updating';
export type VoiceThemeSource = 'distilled' | 'manual';
export type VoiceSourceType = 'paste' | 'upload' | 'sent_email';
export type VoicePromptPurpose = 'email' | 'proposal';

export type VoiceProfile = {
  id: string;
  kind: VoiceProfileKind;
  ownerUserId: string | null;
  accountId: string | null;
  status: VoiceProfileStatus;
  guidanceText: string | null;
  learnFromSentEmail: boolean;
  lastDistilledAt: string | null;
  updatedAt: string;
};

export type VoiceTheme = {
  id: string;
  profileId: string;
  title: string;
  description: string;
  examples: string[];
  weight: number;
  source: VoiceThemeSource;
};

export type VoiceSource = {
  id: string;
  profileId: string;
  type: VoiceSourceType;
  title: string;
  contentText: string;
  included: boolean;
  externalRef: string | null;
  createdAt: string;
};

export type VoiceProfilePageData = {
  profile: VoiceProfile;
  themes: VoiceTheme[];
  sources: VoiceSource[];
};

export const VOICE_MAX_SOURCES = 30;
export const VOICE_MAX_SOURCE_CHARS = 12_000;
export const VOICE_MAX_DISTILL_CHARS = 50_000;
export const VOICE_MAX_DISTILL_PER_DAY = 5;
export const VOICE_MAX_SENT_EMAIL_SAMPLES = 25;
