import { describe, expect, it } from 'vitest';

import { parseRelativeDueDatePhrase, resolveDueDate } from './relative-dates';

const wednesday = new Date(2026, 5, 10, 12, 0, 0, 0);

describe('parseRelativeDueDatePhrase', () => {
  it('parses today and tomorrow', () => {
    expect(parseRelativeDueDatePhrase('today', wednesday)).toBe('2026-06-10');
    expect(parseRelativeDueDatePhrase('tomorrow', wednesday)).toBe(
      '2026-06-11',
    );
  });

  it('parses end of week as Sunday', () => {
    expect(parseRelativeDueDatePhrase('this week', wednesday)).toBe(
      '2026-06-14',
    );
  });

  it('parses weekday names', () => {
    expect(parseRelativeDueDatePhrase('friday', wednesday)).toBe('2026-06-12');
  });
});

describe('resolveDueDate', () => {
  it('prefers explicit ISO dates', () => {
    expect(
      resolveDueDate({
        dueDate: '2026-07-01',
        dueDatePhrase: 'tomorrow',
      }),
    ).toBe('2026-07-01');
  });

  it('falls back to phrase parsing', () => {
    const result = resolveDueDate({ dueDatePhrase: 'tomorrow' });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
