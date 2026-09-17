import { describe, expect, it } from 'vitest';

import {
  SURVEY_STATUS_BADGE_CLASS,
  resolveSurveyStatusTone,
  surveyStatusBadgeClass,
  surveyStatusDisplayLabel,
} from './survey-status';

describe('survey status pills', () => {
  it('maps proposal statuses to British English labels', () => {
    expect(surveyStatusDisplayLabel('draft')).toBe('Draft');
    expect(surveyStatusDisplayLabel('sent')).toBe('Sent');
    expect(surveyStatusDisplayLabel('read')).toBe('Read');
    expect(surveyStatusDisplayLabel('approved')).toBe('Approved');
    expect(surveyStatusDisplayLabel('declined')).toBe('Declined');
  });

  it('accepts aliases used in copy or older rows', () => {
    expect(surveyStatusDisplayLabel('in_progress')).toBe('In progress');
    expect(surveyStatusDisplayLabel('in-progress')).toBe('In progress');
    expect(surveyStatusDisplayLabel('published')).toBe('Published');
    expect(surveyStatusDisplayLabel('archived')).toBe('Archived');
    expect(resolveSurveyStatusTone('published')).toBe('sent');
  });

  it('title-cases unknown slugs instead of showing raw lowercase', () => {
    expect(surveyStatusDisplayLabel('ready_to_issue')).toBe('Ready To Issue');
    expect(resolveSurveyStatusTone('ready_to_issue')).toBe('unknown');
  });

  it('keeps draft amber/grey and sent green', () => {
    expect(resolveSurveyStatusTone('draft')).toBe('draft');
    expect(resolveSurveyStatusTone('DRAFT')).toBe('draft');
    expect(surveyStatusBadgeClass('draft')).toBe(
      SURVEY_STATUS_BADGE_CLASS.draft,
    );
    expect(surveyStatusBadgeClass('sent')).toBe(SURVEY_STATUS_BADGE_CLASS.sent);
    expect(surveyStatusBadgeClass('archived')).toBe(
      SURVEY_STATUS_BADGE_CLASS.archived,
    );
  });
});
