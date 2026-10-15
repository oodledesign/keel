import { describe, expect, it } from 'vitest';

import {
  type SurveyorLeadEvent,
  describeLeadEvent,
  mergeLeadActivity,
} from './lead-activity';

function event(overrides: Partial<SurveyorLeadEvent>): SurveyorLeadEvent {
  return {
    id: 'e1',
    eventType: 'stage_changed',
    fromStage: null,
    toStage: null,
    detail: {},
    actorName: null,
    detailMemberName: null,
    createdAt: '2027-02-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('describeLeadEvent', () => {
  it('describes stage moves with surveyor labels', () => {
    expect(
      describeLeadEvent(event({ fromStage: 'quoted', toStage: 'accepted' })),
    ).toBe('Moved from Quote sent to Accepted');
  });

  it('describes ticks, checkers and reminders', () => {
    expect(
      describeLeadEvent(
        event({
          eventType: 'tick_changed',
          detail: { tick: 'tobSigned', value: true },
        }),
      ),
    ).toBe('Terms of business signed');
    expect(
      describeLeadEvent(
        event({
          eventType: 'tick_changed',
          detail: { tick: 'quoteSentByPhone', value: false },
        }),
      ),
    ).toBe('Quote sent by phone (cleared)');
    expect(
      describeLeadEvent(
        event({
          eventType: 'tick_changed',
          detail: { tick: 'reportCheckedBy', value: 'user-2' },
          detailMemberName: 'Sam',
        }),
      ),
    ).toBe('Report checked by Sam');
    expect(
      describeLeadEvent(
        event({ eventType: 'reminder_sent', detail: { client: true } }),
      ),
    ).toBe('Quote reminder sent to the surveyor and the client');
  });
});

describe('mergeLeadActivity', () => {
  it('merges events and notes newest first', () => {
    const items = mergeLeadActivity(
      [
        event({ id: 'old', createdAt: '2027-02-01T09:00:00.000Z' }),
        event({
          id: 'auto',
          eventType: 'archived',
          createdAt: '2027-02-01T11:00:00.000Z',
        }),
      ],
      [
        {
          id: 'n1',
          content: 'Called the client',
          createdAt: '2027-02-01T10:00:00.000Z',
          createdBy: { name: 'Alex' },
        },
      ],
    );
    expect(items.map((item) => item.id)).toEqual([
      'event-auto',
      'note-n1',
      'event-old',
    ]);
    expect(items[0]?.actor).toBe('Automatic');
    expect(items[1]?.actor).toBe('Alex');
  });
});
