import 'server-only';

import { requireSonioxApiKey } from '~/lib/integrations/soniox/env';

const SONIOX_AUTH_URL = 'https://api.soniox.com/v1/auth/temporary-api-key';

export type CreateSonioxTemporaryApiKeyInput = {
  expiresInSeconds: number;
  maxSessionDurationSeconds: number;
  clientReferenceId: string;
};

export type SonioxTemporaryApiKey = {
  apiKey: string;
  expiresAt: string;
};

export class SonioxApiError extends Error {
  readonly status: number;
  readonly errorType?: string;

  constructor(message: string, status: number, errorType?: string) {
    super(message);
    this.name = 'SonioxApiError';
    this.status = status;
    this.errorType = errorType;
  }
}

export async function createSonioxTemporaryApiKey(
  input: CreateSonioxTemporaryApiKeyInput,
): Promise<SonioxTemporaryApiKey> {
  const apiKey = requireSonioxApiKey();

  const response = await fetch(SONIOX_AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      usage_type: 'transcribe_websocket',
      expires_in_seconds: input.expiresInSeconds,
      single_use: true,
      max_session_duration_seconds: input.maxSessionDurationSeconds,
      client_reference_id: input.clientReferenceId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        api_key?: string;
        expires_at?: string;
        error_type?: string;
        message?: string;
        error_message?: string;
      }
    | null;

  if (!response.ok) {
    throw new SonioxApiError(
      payload?.message ??
        payload?.error_message ??
        `Soniox temporary API key request failed (${response.status})`,
      response.status,
      payload?.error_type,
    );
  }

  if (!payload?.api_key || !payload.expires_at) {
    throw new SonioxApiError(
      'Soniox temporary API key response was missing fields',
      502,
    );
  }

  return {
    apiKey: payload.api_key,
    expiresAt: payload.expires_at,
  };
}
