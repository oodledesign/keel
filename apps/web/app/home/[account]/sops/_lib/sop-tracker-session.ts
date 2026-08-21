const STORAGE_PREFIX = 'ozer-sop-tracker-hidden:';

function storageKey(accountId: string, runId: string) {
  return `${STORAGE_PREFIX}${accountId}:${runId}`;
}

export function isSopTrackerHidden(accountId: string, runId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(storageKey(accountId, runId)) === '1';
  } catch {
    return false;
  }
}

export function setSopTrackerVisible(
  accountId: string,
  runId: string,
  visible: boolean,
) {
  if (typeof window === 'undefined') return;
  try {
    if (visible) {
      sessionStorage.removeItem(storageKey(accountId, runId));
    } else {
      sessionStorage.setItem(storageKey(accountId, runId), '1');
    }
  } catch {
    // ignore quota / private mode
  }
}
