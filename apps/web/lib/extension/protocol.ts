export const EXTENSION_SPEAKER_SOURCES = [
  'active_speaker',
  'tile',
  'caption',
  'unknown',
] as const;

export type ExtensionSpeakerSource = (typeof EXTENSION_SPEAKER_SOURCES)[number];

export const EXTENSION_SPEAKER_CONFIDENCE = ['high', 'medium', 'low'] as const;

export type ExtensionSpeakerConfidence =
  (typeof EXTENSION_SPEAKER_CONFIDENCE)[number];

export type ExtensionSpeakerEvent = {
  name: string | null;
  startedAt: string;
  endedAt: string | null;
  source: ExtensionSpeakerSource;
  confidence: ExtensionSpeakerConfidence;
};

export const OZER_ASSISTANT_DEFAULT_ORIGIN = 'http://127.0.0.1:17834';
export const OZER_ASSISTANT_HEALTH_PATH = '/v1/health';
export const OZER_ASSISTANT_SPEAKER_EVENTS_PATH = '/v1/speaker-events';
export const OZER_ASSISTANT_NATIVE_HOST = 'so.ozer.assistant';

export type OzerAssistantHealth = {
  ok: boolean;
  service?: string;
  recording?: boolean;
  version?: string;
};
