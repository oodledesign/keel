import 'server-only';

const TOKEN_KEY = 'GOV_UK_EPC_API_BEARER_TOKEN';

export function getGovUkEpcBearerToken(): string | null {
  const value = process.env[TOKEN_KEY]?.trim();
  return value || null;
}

export function isGovUkEpcConfigured(): boolean {
  return Boolean(getGovUkEpcBearerToken());
}
