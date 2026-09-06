import { describe, expect, it } from 'vitest';

import {
  assignCampaignAbVariant,
  clampAbSplitPercent,
  pickAbWinner,
  subjectForAbVariant,
  summarizeAbVariant,
} from './campaign-ab';

describe('campaign A/B helpers', () => {
  it('clamps split percent to 10–90', () => {
    expect(clampAbSplitPercent(undefined)).toBe(50);
    expect(clampAbSplitPercent(5)).toBe(10);
    expect(clampAbSplitPercent(99)).toBe(90);
    expect(clampAbSplitPercent(33.6)).toBe(34);
  });

  it('assigns a deterministic variant per campaign + email', () => {
    const first = assignCampaignAbVariant(
      '11111111-1111-1111-1111-111111111111',
      'Ada@Example.com',
      50,
    );
    const second = assignCampaignAbVariant(
      '11111111-1111-1111-1111-111111111111',
      'ada@example.com',
      50,
    );
    expect(first).toBe(second);
    expect(first === 'a' || first === 'b').toBe(true);
  });

  it('uses subject B only for variant b', () => {
    expect(
      subjectForAbVariant({
        subject: 'Hello A',
        subjectB: 'Hello B',
        variant: 'b',
      }),
    ).toBe('Hello B');
    expect(
      subjectForAbVariant({
        subject: 'Hello A',
        subjectB: 'Hello B',
        variant: 'a',
      }),
    ).toBe('Hello A');
  });

  it('picks the winner by unique open rate, then click rate', () => {
    const a = summarizeAbVariant({
      variant: 'a',
      sent: 100,
      uniqueOpens: 20,
      uniqueClicks: 2,
    });
    const b = summarizeAbVariant({
      variant: 'b',
      sent: 100,
      uniqueOpens: 40,
      uniqueClicks: 1,
    });
    expect(pickAbWinner(a, b)).toEqual({
      variant: 'b',
      reason: 'Higher unique open rate',
    });

    const tiedOpensA = summarizeAbVariant({
      variant: 'a',
      sent: 50,
      uniqueOpens: 10,
      uniqueClicks: 8,
    });
    const tiedOpensB = summarizeAbVariant({
      variant: 'b',
      sent: 50,
      uniqueOpens: 10,
      uniqueClicks: 2,
    });
    expect(pickAbWinner(tiedOpensA, tiedOpensB).variant).toBe('a');
    expect(pickAbWinner(tiedOpensA, tiedOpensB).reason).toBe(
      'Higher unique click rate',
    );
  });
});
