const DAY_MS = 24 * 60 * 60 * 1000;
export const INSTAGRAM_TOKEN_MIN_AGE_MS = DAY_MS;
export const INSTAGRAM_TOKEN_REFRESH_AFTER_MS = 50 * DAY_MS;
export const INSTAGRAM_TOKEN_EXPIRY_WINDOW_MS = 10 * DAY_MS;

export type InstagramTokenRefreshTimes = {
  last_refreshed_at: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  created_at: string | null;
};

export function isInstagramTokenDueForRefresh(
  row: InstagramTokenRefreshTimes,
  now = Date.now(),
): boolean {
  const lastRefreshed = parseTime(
    row.last_refreshed_at ?? row.connected_at ?? row.created_at,
  );

  if (
    lastRefreshed != null &&
    now - lastRefreshed < INSTAGRAM_TOKEN_MIN_AGE_MS
  ) {
    return false;
  }

  if (lastRefreshed == null) {
    return true;
  }

  if (now - lastRefreshed >= INSTAGRAM_TOKEN_REFRESH_AFTER_MS) {
    return true;
  }

  const expiresAt = parseTime(row.token_expires_at);
  if (
    expiresAt != null &&
    expiresAt - now <= INSTAGRAM_TOKEN_EXPIRY_WINDOW_MS
  ) {
    return true;
  }

  return false;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}
