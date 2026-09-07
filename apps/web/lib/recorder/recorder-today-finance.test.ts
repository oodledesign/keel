import { describe, expect, it } from 'vitest';

import {
  mapDashboardTrendToRecorderMonths,
  pickFinanceWorkspace,
} from './recorder-today-finance.shared';

describe('mapDashboardTrendToRecorderMonths', () => {
  it('maps dashboard expenses to outgoings without changing amounts', () => {
    const months = mapDashboardTrendToRecorderMonths([
      {
        month: 'Apr',
        monthKey: '2026-04',
        income: 1200.5,
        expenses: 400,
        net: 800.5,
        isCurrent: false,
      },
      {
        month: 'Sep',
        income: 0,
        expenses: 0,
        net: 0,
        isCurrent: true,
      },
    ]);

    expect(months).toEqual([
      {
        month: 'Apr',
        month_key: '2026-04',
        income: 1200.5,
        outgoings: 400,
        net: 800.5,
        is_current: false,
      },
      {
        month: 'Sep',
        month_key: 'Sep',
        income: 0,
        outgoings: 0,
        net: 0,
        is_current: true,
      },
    ]);
  });
});

describe('pickFinanceWorkspace', () => {
  const studio = { id: 'studio', name: 'Studio', slug: 'studio' };
  const survey = { id: 'survey', name: 'Survey', slug: 'survey' };

  it('returns null when no workspace has real finance data', () => {
    expect(
      pickFinanceWorkspace([studio, survey], new Set(), studio.id),
    ).toBeNull();
  });

  it('prefers the requested workspace when it has data', () => {
    expect(
      pickFinanceWorkspace(
        [studio, survey],
        new Set(['studio', 'survey']),
        'survey',
      ),
    ).toEqual(survey);
  });

  it('falls back to the first workspace that has data', () => {
    expect(
      pickFinanceWorkspace([studio, survey], new Set(['survey']), 'missing'),
    ).toEqual(survey);
  });
});
