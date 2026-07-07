import { describe, expect, it } from 'vitest';

import {
  adjustPhasePlanDates,
  DEFAULT_WORKSPACE_SCHEDULING,
  getWeekdayForYmd,
  isWorkingDayYmd,
  snapDueDateYmd,
  snapStartDateYmd,
} from '~/lib/workspace-focus';

describe('workspace scheduling helpers', () => {
  const monFri = DEFAULT_WORKSPACE_SCHEDULING;

  it('detects weekdays in timezone', () => {
    expect(getWeekdayForYmd('2026-06-19', 'UTC')).toBe(5);
    expect(getWeekdayForYmd('2026-06-20', 'UTC')).toBe(6);
  });

  it('snaps due dates back to the previous working day', () => {
    expect(snapDueDateYmd('2026-06-20', monFri)).toBe('2026-06-19');
    expect(snapDueDateYmd('2026-06-19', monFri)).toBe('2026-06-19');
  });

  it('snaps start dates forward to the next working day', () => {
    expect(snapStartDateYmd('2026-06-20', monFri)).toBe('2026-06-22');
    expect(snapStartDateYmd('2026-06-19', monFri)).toBe('2026-06-19');
  });

  it('respects custom work days', () => {
    const tueThu = {
      ...monFri,
      work_days: [2, 4],
    };

    expect(isWorkingDayYmd('2026-06-16', tueThu)).toBe(true);
    expect(isWorkingDayYmd('2026-06-17', tueThu)).toBe(false);
    expect(snapDueDateYmd('2026-06-17', tueThu)).toBe('2026-06-16');
  });

  it('adjusts generated phase plan dates', () => {
    const adjusted = adjustPhasePlanDates(
      [
        {
          name: 'Build',
          start_date: '2026-06-20',
          due_date: '2026-06-21',
          tasks: [{ due_date: '2026-06-21' }],
        },
      ],
      monFri,
    );

    expect(adjusted[0]?.start_date).toBe('2026-06-22');
    expect(adjusted[0]?.due_date).toBe('2026-06-19');
    expect(adjusted[0]?.tasks?.[0]?.due_date).toBe('2026-06-19');
  });
});
