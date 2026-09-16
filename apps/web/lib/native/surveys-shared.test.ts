import { describe, expect, it } from 'vitest';

import { NativeHttpError } from './http';
import {
  mapNativeSurvey,
  parseNativeSurveyId,
  parseNativeSurveyType,
  workspaceShowsNativeSurveys,
} from './surveys-shared';

describe('workspaceShowsNativeSurveys', () => {
  it('is building-surveyor only', () => {
    expect(workspaceShowsNativeSurveys('building_surveyor')).toBe(true);
    expect(workspaceShowsNativeSurveys('work_design')).toBe(false);
    expect(workspaceShowsNativeSurveys('commercial_property')).toBe(false);
    expect(workspaceShowsNativeSurveys('personal')).toBe(false);
    expect(workspaceShowsNativeSurveys(null)).toBe(false);
  });
});

describe('parseNativeSurveyType', () => {
  it('defaults to RICS Home Survey Level 2', () => {
    expect(parseNativeSurveyType(null)).toBe('rics_hss_l2');
    expect(parseNativeSurveyType('')).toBe('rics_hss_l2');
    expect(parseNativeSurveyType('mystery')).toBe('rics_hss_l2');
  });

  it('keeps known template keys', () => {
    expect(parseNativeSurveyType('dilapidations')).toBe('dilapidations');
    expect(parseNativeSurveyType('rics_hss_l3')).toBe('rics_hss_l3');
  });
});

describe('parseNativeSurveyId', () => {
  it('accepts a uuid and rejects junk', () => {
    expect(parseNativeSurveyId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(() => parseNativeSurveyId('not-a-id')).toThrow(NativeHttpError);
  });
});

describe('mapNativeSurvey', () => {
  it('fills labels and counts', () => {
    const mapped = mapNativeSurvey(
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: '12 High Street',
        status: 'draft',
        survey_type: 'rics_hss_l1',
        client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        created_at: '2026-09-15T10:00:00Z',
        updated_at: '2026-09-15T10:00:00Z',
      },
      'bracketts',
      { clientName: 'Hope and Wonder', sessionCount: 2, photoCount: 4 },
    );

    expect(mapped.title).toBe('12 High Street');
    expect(mapped.survey_type).toBe('rics_hss_l1');
    expect(mapped.survey_type_label).toBe('RICS Home Survey Level 1');
    expect(mapped.survey_level).toBe(2);
    expect(mapped.client_name).toBe('Hope and Wonder');
    expect(mapped.session_count).toBe(2);
    expect(mapped.photo_count).toBe(4);
    expect(mapped.workspace).toBe('bracketts');
  });
});
