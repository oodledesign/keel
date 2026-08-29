export type CirculationConsentStatus =
  | 'subscribed'
  | 'unsubscribed'
  | 'suppressed'
  | 'unknown';

export function normalizeCirculationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isCirculationBlocked(
  status: CirculationConsentStatus | null | undefined,
): boolean {
  return status === 'unsubscribed' || status === 'suppressed';
}

/** Auto-mailouts only go to explicit subscribers (website form / opt-in). */
export function isCirculationAutoEligible(
  status: CirculationConsentStatus | null | undefined,
): boolean {
  return status === 'subscribed';
}

/** Manual send: anyone who is not unsubscribed or suppressed. */
export function isCirculationManualEligible(
  status: CirculationConsentStatus | null | undefined,
): boolean {
  return !isCirculationBlocked(status);
}
