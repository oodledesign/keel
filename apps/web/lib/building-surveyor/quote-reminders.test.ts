import { describe, expect, it } from 'vitest';

import {
  type QuoteReminderEvent,
  selectDueQuoteReminders,
} from './quote-reminders';

const NOW = new Date('2027-02-10T08:30:00.000Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const deal = (
  id: string,
  overrides: Partial<{
    stage: string;
    updatedAt: string;
    accountId: string;
  }> = {},
) => ({
  id,
  accountId: 'acc-1',
  stage: 'quoted',
  updatedAt: daysAgo(1),
  ...overrides,
});

const entered = (dealId: string, at: string): QuoteReminderEvent => ({
  dealId,
  eventType: 'stage_changed',
  toStage: 'quoted',
  createdAt: at,
});

const reminded = (dealId: string, at: string): QuoteReminderEvent => ({
  dealId,
  eventType: 'reminder_sent',
  toStage: null,
  createdAt: at,
});

function select(
  deals: ReturnType<typeof deal>[],
  events: QuoteReminderEvent[],
  days = new Map<string, number>(),
) {
  return selectDueQuoteReminders({
    deals,
    events,
    reminderDaysByAccount: days,
    defaultReminderDays: 3,
    now: NOW,
  }).map((item) => item.dealId);
}

describe('selectDueQuoteReminders', () => {
  it('reminds once the lead has been in Quote sent for the threshold', () => {
    expect(
      select(
        [deal('due'), deal('fresh')],
        [entered('due', daysAgo(3)), entered('fresh', daysAgo(2))],
      ),
    ).toEqual(['due']);
  });

  it('sends once per entry into the stage', () => {
    expect(
      select(
        [deal('a')],
        [entered('a', daysAgo(5)), reminded('a', daysAgo(2))],
      ),
    ).toEqual([]);
    expect(
      select(
        [deal('a')],
        [
          entered('a', daysAgo(10)),
          reminded('a', daysAgo(7)),
          entered('a', daysAgo(4)),
        ],
      ),
    ).toEqual(['a']);
  });

  it('uses each workspace threshold', () => {
    expect(
      select(
        [deal('a'), deal('b', { accountId: 'acc-2' })],
        [entered('a', daysAgo(4)), entered('b', daysAgo(4))],
        new Map([['acc-2', 7]]),
      ),
    ).toEqual(['a']);
  });

  it('skips leads in other stages', () => {
    expect(
      select([deal('a', { stage: 'accepted' })], [entered('a', daysAgo(9))]),
    ).toEqual([]);
  });

  it('reminds a lead with no logged entry only once', () => {
    expect(select([deal('old', { updatedAt: daysAgo(20) })], [])).toEqual([
      'old',
    ]);
    expect(
      select(
        [deal('old', { updatedAt: daysAgo(20) })],
        [reminded('old', daysAgo(10))],
      ),
    ).toEqual([]);
  });
});
