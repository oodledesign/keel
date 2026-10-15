import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SURVEYOR_PIPELINE_SETTINGS,
  EMPTY_SURVEYOR_LEAD,
  applySurveyorTickInput,
  idleDays,
  leadTrafficLight,
  normalizeSurveyorPipelineSettings,
  resolveSurveyorTickUpdate,
  selectLeadsToArchive,
  surveyLevelForLeadType,
  surveyorLeadInputToColumns,
} from './surveyor-lead';

const NOW = '2027-02-01T12:00:00.000Z';
const daysAgo = (days: number) =>
  new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString();

describe('surveyorLeadInputToColumns', () => {
  it('maps only the keys sent, trimming text and clamping numbers', () => {
    expect(
      surveyorLeadInputToColumns({
        surveyType: 'rics_hss_l2',
        tenure: '  ',
        solicitorName: ' Smith & Co ',
        bedrooms: 3.4,
        purchasePricePence: -10,
      }),
    ).toEqual({
      survey_type: 'rics_hss_l2',
      tenure: null,
      solicitor_name: 'Smith & Co',
      bedrooms: 3,
      purchase_price_pence: 0,
    });
    expect(surveyorLeadInputToColumns(undefined)).toEqual({});
  });
});

describe('surveyLevelForLeadType', () => {
  it('maps RICS levels and leaves commercial alone', () => {
    expect(surveyLevelForLeadType('rics_hss_l2')).toBe(2);
    expect(surveyLevelForLeadType('rics_hss_l3')).toBe(3);
    expect(surveyLevelForLeadType('commercial_condition')).toBeNull();
    expect(surveyLevelForLeadType(null)).toBeNull();
  });
});

describe('resolveSurveyorTickUpdate', () => {
  it('stamps terms of business when signed and clears when unticked', () => {
    const on = resolveSurveyorTickUpdate({
      current: EMPTY_SURVEYOR_LEAD,
      next: { tobSigned: true },
      userId: 'user-1',
      now: NOW,
    });
    expect(on.columns).toEqual({ tob_signed: true, tob_signed_at: NOW });
    expect(on.changes).toEqual([{ tick: 'tobSigned', value: true }]);

    const off = resolveSurveyorTickUpdate({
      current: { ...EMPTY_SURVEYOR_LEAD, tobSigned: true, tobSignedAt: NOW },
      next: { tobSigned: false },
      userId: 'user-1',
      now: NOW,
    });
    expect(off.columns).toEqual({ tob_signed: false, tob_signed_at: null });
  });

  it('defaults the report checker to the current user', () => {
    const result = resolveSurveyorTickUpdate({
      current: EMPTY_SURVEYOR_LEAD,
      next: { reportChecked: true },
      userId: 'user-1',
      now: NOW,
    });
    expect(result.columns).toEqual({
      report_checked: true,
      report_checked_at: NOW,
      report_checked_by: 'user-1',
    });
    expect(result.changes.map((change) => change.tick)).toEqual([
      'reportChecked',
      'reportCheckedBy',
    ]);
  });

  it('produces nothing for unchanged ticks', () => {
    const result = resolveSurveyorTickUpdate({
      current: { ...EMPTY_SURVEYOR_LEAD, quoteSentByEmail: true },
      next: { quoteSentByEmail: true },
      userId: 'user-1',
      now: NOW,
    });
    expect(result).toEqual({ columns: {}, changes: [] });
  });
});

describe('applySurveyorTickInput', () => {
  it('clears the checker when the report check is removed', () => {
    const next = applySurveyorTickInput(
      {
        ...EMPTY_SURVEYOR_LEAD,
        reportChecked: true,
        reportCheckedBy: 'user-1',
        reportCheckedAt: NOW,
      },
      { reportChecked: false },
      NOW,
    );
    expect(next.reportChecked).toBe(false);
    expect(next.reportCheckedBy).toBeNull();
    expect(next.reportCheckedAt).toBeNull();
  });
});

describe('pipeline settings', () => {
  it('falls back to defaults and keeps red at or above amber', () => {
    expect(normalizeSurveyorPipelineSettings(null)).toEqual(
      DEFAULT_SURVEYOR_PIPELINE_SETTINGS,
    );
    expect(
      normalizeSurveyorPipelineSettings({
        lead_amber_days: 10,
        lead_red_days: 5,
        lead_archive_days: 0,
        quote_reminder_days: 'x',
        quote_reminder_client_email: true,
      }),
    ).toEqual({
      leadAmberDays: 10,
      leadRedDays: 10,
      leadArchiveDays: 30,
      quoteReminderDays: 3,
      quoteReminderClientEmail: true,
    });
  });
});

describe('traffic lights', () => {
  const thresholds = { leadAmberDays: 7, leadRedDays: 14 };
  const now = new Date(NOW);

  it('turns amber and red at the thresholds', () => {
    expect(leadTrafficLight(daysAgo(6), thresholds, now)).toBe('green');
    expect(leadTrafficLight(daysAgo(7), thresholds, now)).toBe('amber');
    expect(leadTrafficLight(daysAgo(14), thresholds, now)).toBe('red');
    expect(leadTrafficLight(null, thresholds, now)).toBeNull();
  });

  it('never reports negative idle days', () => {
    expect(idleDays('2030-01-01T00:00:00.000Z', now)).toBe(0);
  });
});

describe('selectLeadsToArchive', () => {
  it('lists idle inquiry and quote leads, oldest first', () => {
    const leads = [
      { id: 'a', stage: 'quoted', lastActivityAt: daysAgo(31) },
      { id: 'b', stage: 'enquiry', lastActivityAt: daysAgo(45) },
      { id: 'c', stage: 'booked', lastActivityAt: daysAgo(60) },
      { id: 'd', stage: 'quoted', lastActivityAt: daysAgo(10) },
      { id: 'e', stage: 'enquiry', lastActivityAt: null },
    ];
    expect(
      selectLeadsToArchive(leads, 30, new Date(NOW)).map((lead) => lead.id),
    ).toEqual(['b', 'a']);
  });
});
