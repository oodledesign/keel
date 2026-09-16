import 'server-only';

// Platform credential (not per-user). Exact name for Vercel Production and
// new box processes: GOV_UK_EPC_API_BEARER_TOKEN. Set it as a Sensitive env
// on the web project (Production). Do not expose as NEXT_PUBLIC_*.
// Aliases stay for older local env files and can be dropped later.
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
