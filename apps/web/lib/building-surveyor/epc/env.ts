import 'server-only';

// Platform credential (not per-user). Vercel Production and new box processes
// receive GOV_UK_EPC_API_BEARER_TOKEN. Aliases stay for older local env files.
const TOKEN_KEYS = [
  'GOV_UK_EPC_API_BEARER_TOKEN',
  'EPC_API_BEARER_TOKEN',
  'GOV_UK_EPC_BEARER_TOKEN',
] as const;

export function getGovUkEpcBearerToken(): string | null {
  for (const key of TOKEN_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function isGovUkEpcConfigured(): boolean {
  return Boolean(getGovUkEpcBearerToken());
}
