import 'server-only';

export const SONIOX_WEBSOCKET_URL =
  'wss://stt-rt.soniox.com/transcribe-websocket';

export const SONIOX_REALTIME_MODEL = 'stt-rt-v5';

export function getSonioxApiKey() {
  return process.env.SONIOX_API_KEY?.trim() ?? '';
}

export function isSonioxConfigured() {
  return getSonioxApiKey().length > 0;
}

export function requireSonioxApiKey() {
  const apiKey = getSonioxApiKey();
  if (!apiKey) {
    throw new Error(
      'Soniox is not configured. Set SONIOX_API_KEY in the server environment.',
    );
  }
  return apiKey;
}
