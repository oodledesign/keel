import { describe, expect, it } from 'vitest';

import {
  formatPaymentPlanText,
  hasSmartFieldTokens,
  listUnresolvedSmartFields,
  renderContractSmartFields,
} from './smart-fields';

const now = new Date('2026-09-03T12:00:00.000Z');

describe('renderContractSmartFields', () => {
  it('resolves client, amount, date and author tokens', () => {
    const html = [
      '<p>Dear {{client.fullName}} of {{client.company}},</p>',
      '<p>Total {{contract.total}} dated {{contract.date}}</p>',
      '<p>From {{author.name}} at {{account.name}}</p>',
    ].join('');

    const resolved = renderContractSmartFields(html, {
      client: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        display_name: 'Ada Lovelace',
        company_name: 'Analytical Engines',
        email: 'ada@example.com',
      },
      contract: {
        title: 'Services agreement',
        total_pence: 125000,
        currency: 'gbp',
      },
      sender: { first_name: 'Dan', last_name: 'Potter' },
      authorName: 'Dan Potter',
      accountName: 'Ozer Studio',
      now,
    });

    expect(resolved).toContain('Dear Ada Lovelace of Analytical Engines');
    expect(resolved).toContain('£1,250.00');
    expect(resolved).toContain('3 September 2026');
    expect(resolved).toContain('From Dan Potter at Ozer Studio');
    expect(hasSmartFieldTokens(resolved)).toBe(false);
  });

  it('resolves payment plan rows to labelled amounts', () => {
    const resolved = renderContractSmartFields('{{contract.paymentPlan}}', {
      contract: {
        total_pence: 100000,
        currency: 'gbp',
        payment_plan: [
          { label: 'Deposit', percent: 40 },
          { label: 'Balance', percent: 60 },
        ],
      },
      now,
    });
    expect(resolved).toContain('Deposit: 40% (£400.00)');
    expect(resolved).toContain('Balance: 60% (£600.00)');
  });

  it('leaves unknown tokens in place', () => {
    expect(renderContractSmartFields('Keep {{unknown.token}}', {})).toBe(
      'Keep {{unknown.token}}',
    );
  });

  it('tolerates whitespace inside braces', () => {
    expect(
      renderContractSmartFields('Hi {{ client.firstName }}', {
        client: { first_name: 'Ada' },
      }),
    ).toBe('Hi Ada');
  });

  it('falls back to "there" when the client has no first name', () => {
    expect(renderContractSmartFields('Hi {{client.firstName}}', {})).toBe(
      'Hi there',
    );
  });
});

describe('hasSmartFieldTokens / listUnresolvedSmartFields', () => {
  it('detects remaining placeholders', () => {
    const html = 'Hello {{client.fullName}} and {{contract.total}}';
    expect(hasSmartFieldTokens(html)).toBe(true);
    expect(listUnresolvedSmartFields(html)).toEqual([
      '{{client.fullName}}',
      '{{contract.total}}',
    ]);
    expect(hasSmartFieldTokens('Hello Ada')).toBe(false);
  });
});

describe('formatPaymentPlanText', () => {
  it('returns empty string when there are no instalments', () => {
    expect(formatPaymentPlanText([])).toBe('');
    expect(formatPaymentPlanText(null)).toBe('');
  });
});
