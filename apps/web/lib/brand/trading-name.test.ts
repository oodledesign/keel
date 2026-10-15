import { describe, expect, it } from 'vitest';

import { resolveTradingOrAccountName } from './trading-name';

describe('resolveTradingOrAccountName', () => {
  it('prefers trading name over workspace name', () => {
    expect(
      resolveTradingOrAccountName({
        tradingName: 'Bracketts LLP',
        accountName: 'Bracketts workspace',
      }),
    ).toBe('Bracketts LLP');
  });

  it('falls back to the workspace name', () => {
    expect(
      resolveTradingOrAccountName({
        tradingName: '  ',
        accountName: 'Bracketts workspace',
      }),
    ).toBe('Bracketts workspace');
  });

  it('uses the product fallback last', () => {
    expect(
      resolveTradingOrAccountName({
        tradingName: null,
        accountName: null,
        fallback: 'Ozer',
      }),
    ).toBe('Ozer');
  });
});
