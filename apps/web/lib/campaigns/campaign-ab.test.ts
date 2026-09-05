import { describe, expect, it } from 'vitest';

import {
  assignSubjectVariant,
  pickAbWinner,
  subjectForVariant,
  summarizeAbVariants,
} from './campaign-ab';

describe('campaign A/B subjects', () => {
  it('assigns the same email to the same variant', () => {
    const first = assignSubjectVariant('alex@example.com', 50);
    const second = assignSubjectVariant('alex@example.com', 50);
    expect(first).toBe(second);
  });

  it('splits a mixed audience across A and B', () => {
    const emails = Array.from({ length: 40 }, (_, i) => `user${i}@example.com`);
    const variants = emails.map((email) => assignSubjectVariant(email, 50));
    const aCount = variants.filter((v) => v === 'a').length;
    expect(aCount).toBeGreaterThan(8);
    expect(aCount).toBeLessThan(32);
  });

  it('uses subject B only when A/B is enabled and the variant is B', () => {
    expect(
      subjectForVariant({
        subjectA: 'Hello A',
        subjectB: 'Hello B',
        variant: 'b',
        abEnabled: true,
      }),
    ).toBe('Hello B');
    expect(
      subjectForVariant({
        subjectA: 'Hello A',
        subjectB: 'Hello B',
        variant: 'b',
        abEnabled: false,
      }),
    ).toBe('Hello A');
  });

  it('picks the winner by unique open rate', () => {
    const stats = summarizeAbVariants({
      subjectA: 'A',
      subjectB: 'B',
      recipients: [
        {
          subjectVariant: 'a',
          status: 'sent',
          openedAt: '2026-01-01',
          clickedAt: null,
          bouncedAt: null,
          complaintAt: null,
          deliveredAt: '2026-01-01',
        },
        {
          subjectVariant: 'a',
          status: 'sent',
          openedAt: null,
          clickedAt: null,
          bouncedAt: null,
          complaintAt: null,
          deliveredAt: '2026-01-01',
        },
        {
          subjectVariant: 'b',
          status: 'sent',
          openedAt: '2026-01-01',
          clickedAt: null,
          bouncedAt: null,
          complaintAt: null,
          deliveredAt: '2026-01-01',
        },
        {
          subjectVariant: 'b',
          status: 'sent',
          openedAt: '2026-01-02',
          clickedAt: null,
          bouncedAt: null,
          complaintAt: null,
          deliveredAt: '2026-01-01',
        },
      ],
    });
    expect(pickAbWinner(stats)).toBe('b');
  });
});
