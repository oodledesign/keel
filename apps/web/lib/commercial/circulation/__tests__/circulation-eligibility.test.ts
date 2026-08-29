import { describe, expect, it } from 'vitest';

import {
  isCirculationAutoEligible,
  isCirculationBlocked,
  isCirculationManualEligible,
  normalizeCirculationEmail,
} from '../circulation-eligibility';

describe('circulation eligibility', () => {
  it('normalizes emails', () => {
    expect(normalizeCirculationEmail('  Sam@Agency.COM ')).toBe(
      'sam@agency.com',
    );
  });

  it('blocks unsubscribed and suppressed', () => {
    expect(isCirculationBlocked('unsubscribed')).toBe(true);
    expect(isCirculationBlocked('suppressed')).toBe(true);
    expect(isCirculationBlocked('subscribed')).toBe(false);
    expect(isCirculationBlocked('unknown')).toBe(false);
    expect(isCirculationBlocked(null)).toBe(false);
  });

  it('allows manual send without a stored preference', () => {
    expect(isCirculationManualEligible('unknown')).toBe(true);
    expect(isCirculationManualEligible(null)).toBe(true);
    expect(isCirculationManualEligible('subscribed')).toBe(true);
    expect(isCirculationManualEligible('unsubscribed')).toBe(false);
  });

  it('auto-sends only to explicit subscribers', () => {
    expect(isCirculationAutoEligible('subscribed')).toBe(true);
    expect(isCirculationAutoEligible('unknown')).toBe(false);
    expect(isCirculationAutoEligible('unsubscribed')).toBe(false);
  });
});
