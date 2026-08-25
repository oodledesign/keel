const STORAGE_PREFIX = 'ozer:holiday-welcome:';

export function holidayWelcomeStorageKey(
  accountId: string,
  untilKey: string,
): string {
  return `${STORAGE_PREFIX}${accountId}:${untilKey}`;
}

export function markHolidayWelcomePending(
  accountId: string,
  untilKey: string,
): void {
  try {
    localStorage.setItem(holidayWelcomeStorageKey(accountId, untilKey), '1');
  } catch {
    // ignore quota / private mode
  }
}

export function isHolidayWelcomePending(
  accountId: string,
  untilKey: string,
): boolean {
  try {
    return (
      localStorage.getItem(holidayWelcomeStorageKey(accountId, untilKey)) ===
      '1'
    );
  } catch {
    return false;
  }
}

export function clearHolidayWelcomePending(
  accountId: string,
  untilKey: string,
): void {
  try {
    localStorage.removeItem(holidayWelcomeStorageKey(accountId, untilKey));
  } catch {
    // ignore
  }
}

/** Find any pending welcome flag for an account (until key unknown). */
export function findPendingHolidayWelcomeUntil(
  accountId: string,
): string | null {
  try {
    const prefix = `${STORAGE_PREFIX}${accountId}:`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        return key.slice(prefix.length);
      }
    }
  } catch {
    // ignore
  }
  return null;
}
