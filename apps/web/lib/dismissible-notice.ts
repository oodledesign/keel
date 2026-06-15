const STORAGE_PREFIX = 'keel_notice_dismissed:';

export function isNoticeDismissed(key: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  if (!raw) {
    return false;
  }

  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt)) {
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
