const STORAGE_PREFIX = 'ozer_notice_dismissed:';
const LEGACY_STORAGE_PREFIX = 'keel_notice_dismissed:';

function readDismissedExpiry(key: string): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw =
    localStorage.getItem(`${STORAGE_PREFIX}${key}`) ??
    localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${key}`);
  if (!raw) {
    return null;
  }

  const expiresAt = Number(raw);
  return Number.isFinite(expiresAt) ? expiresAt : null;
}

export function isNoticeDismissed(key: string): boolean {
  const expiresAt = readDismissedExpiry(key);
  if (expiresAt === null) {
    return false;
  }

  return Date.now() < expiresAt;
}

export function dismissNotice(key: string, days = 14) {
  if (typeof window === 'undefined') {
    return;
  }

  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, String(expiresAt));
}
