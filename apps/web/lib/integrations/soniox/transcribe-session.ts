import 'server-only';

import { createSonioxTemporaryApiKey } from '~/lib/integrations/soniox/create-temporary-api-key';
import {
  SONIOX_REALTIME_MODEL,
  SONIOX_WEBSOCKET_URL,
} from '~/lib/integrations/soniox/env';
import type { RecorderUsageSummary } from '~/lib/recorder/access';

const TEMP_KEY_EXPIRES_SECONDS = 120;
const SONIOX_MAX_SESSION_SECONDS = 18_000;
const MIN_REMAINING_SECONDS = 60;

export const SONIOX_RECORDER_AUDIO = {
  audio_format: 's16le',
  sample_rate: 16_000,
  num_channels: 1,
} as const;

export type SonioxRecorderStartMessage = {
  api_key: string;
  model: string;
  audio_format: string;
  sample_rate: number;
  num_channels: number;
  language_hints: string[];
  enable_speaker_diarization: boolean;
  enable_endpoint_detection: boolean;
};

export type SonioxTranscribeSession = {
  provider: 'soniox';
  temporary_api_key: string;
  expires_at: string;
  expires_in_seconds: number;
  max_session_duration_seconds: number;
  websocket_url: string;
  start_message: SonioxRecorderStartMessage;
  usage: {
    tier: RecorderUsageSummary['tier'];
    period: string;
    duration_seconds: number;
    limits: {
      max_duration_seconds_per_month: number;
    };
    remaining: {
      duration_seconds: number;
    };
  };
};

export class SonioxTranscribeSessionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SonioxTranscribeSessionError';
    this.status = status;
  }
}

function resolveMaxSessionDurationSeconds(summary: RecorderUsageSummary) {
  return Math.min(summary.remainingDurationSeconds, SONIOX_MAX_SESSION_SECONDS);
}

export async function createSonioxTranscribeSession(
  userId: string,
  summary: RecorderUsageSummary,
): Promise<SonioxTranscribeSession> {
  if (summary.remainingDurationSeconds < MIN_REMAINING_SECONDS) {
    throw new SonioxTranscribeSessionError(
      'Desktop recorder recording time limit reached for this month. Upgrade a paid workspace for more recording time.',
      429,
    );
  }

  const maxSessionDurationSeconds = resolveMaxSessionDurationSeconds(summary);

  const temporaryKey = await createSonioxTemporaryApiKey({
    expiresInSeconds: TEMP_KEY_EXPIRES_SECONDS,
    maxSessionDurationSeconds,
    clientReferenceId: userId,
  });

  const startMessage: SonioxRecorderStartMessage = {
    api_key: temporaryKey.apiKey,
    model: SONIOX_REALTIME_MODEL,
    ...SONIOX_RECORDER_AUDIO,
    language_hints: ['en'],
    enable_speaker_diarization: true,
    enable_endpoint_detection: true,
  };

  return {
    provider: 'soniox',
    temporary_api_key: temporaryKey.apiKey,
    expires_at: temporaryKey.expiresAt,
    expires_in_seconds: TEMP_KEY_EXPIRES_SECONDS,
    max_session_duration_seconds: maxSessionDurationSeconds,
    websocket_url: SONIOX_WEBSOCKET_URL,
    start_message: startMessage,
    usage: {
      tier: summary.tier,
      period: summary.period,
      duration_seconds: summary.durationSeconds,
      limits: {
        max_duration_seconds_per_month:
          summary.limits.maxDurationSecondsPerMonth,
      },
      remaining: {
        duration_seconds: summary.remainingDurationSeconds,
      },
    },
  };
}
