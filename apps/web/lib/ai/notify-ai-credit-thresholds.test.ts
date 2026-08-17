import { describe, expect, it } from 'vitest';

import {
  AI_CREDIT_ALERT_BIT,
  selectCreditAlertThresholds,
} from './notify-ai-credit-thresholds';

describe('selectCreditAlertThresholds', () => {
  it('sends 50% only when dipping just under half', () => {
    const result = selectCreditAlertThresholds({ pctLeft: 49, alertsSent: 0 });
    expect(result?.emailKey).toBe('pct50');
    expect(result?.markBits).toBe(AI_CREDIT_ALERT_BIT.pct50);
  });

  it('on a jump past several thresholds, emails the lowest and marks all crossed', () => {
    const result = selectCreditAlertThresholds({ pctLeft: 5, alertsSent: 0 });
    expect(result?.emailKey).toBe('pct10');
    expect(result?.markBits).toBe(
      AI_CREDIT_ALERT_BIT.pct50 |
        AI_CREDIT_ALERT_BIT.pct25 |
        AI_CREDIT_ALERT_BIT.pct10,
    );
  });

  it('does not re-send thresholds already marked', () => {
    const result = selectCreditAlertThresholds({
      pctLeft: 5,
      alertsSent:
        AI_CREDIT_ALERT_BIT.pct50 |
        AI_CREDIT_ALERT_BIT.pct25 |
        AI_CREDIT_ALERT_BIT.pct10,
    });
    expect(result).toBeNull();
  });

  it('treats exactly 50% as crossed (inclusive boundary)', () => {
    const result = selectCreditAlertThresholds({ pctLeft: 50, alertsSent: 0 });
    expect(result?.emailKey).toBe('pct50');
  });

  it('does not alert when still above 50%', () => {
    const result = selectCreditAlertThresholds({ pctLeft: 50.1, alertsSent: 0 });
    expect(result).toBeNull();
  });
});
