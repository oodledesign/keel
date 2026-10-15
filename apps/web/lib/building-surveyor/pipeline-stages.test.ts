import { describe, expect, it } from 'vitest';

import {
  BUILDING_SURVEYOR_CORE_FLOW_STAGES,
  BUILDING_SURVEYOR_PIPELINE_LABELS,
  DEFAULT_BUILDING_SURVEYOR_BOARD_NAME,
  canOpenSurveyorAcceptedGate,
  displayBuildingSurveyorBoardName,
  isBuildingSurveyorPipelineStage,
  isBuildingSurveyorTerminalStage,
  publicFormPipelineStage,
  surveyorStageBlockedByTob,
  surveyorStageOnAccepted,
  surveyorStageOnEnquiry,
  surveyorStageOnQuoteSent,
} from './pipeline-stages';

describe('displayBuildingSurveyorBoardName', () => {
  it('uses Pipeline as the product label', () => {
    expect(DEFAULT_BUILDING_SURVEYOR_BOARD_NAME).toBe('Pipeline');
    expect(displayBuildingSurveyorBoardName(null)).toBe('Pipeline');
    expect(displayBuildingSurveyorBoardName('')).toBe('Pipeline');
    expect(displayBuildingSurveyorBoardName('Enquiries')).toBe('Pipeline');
    expect(displayBuildingSurveyorBoardName('enquiries')).toBe('Pipeline');
  });

  it('keeps a custom board name', () => {
    expect(displayBuildingSurveyorBoardName('Survey jobs')).toBe('Survey jobs');
  });
});

describe('building surveyor pipeline helpers', () => {
  it('labels Quoted as Quote sent and keeps the Ben Carey core flow', () => {
    expect(BUILDING_SURVEYOR_PIPELINE_LABELS.quoted).toBe('Quote sent');
    expect(BUILDING_SURVEYOR_CORE_FLOW_STAGES).toEqual([
      'enquiry',
      'quoted',
      'accepted',
      'booked',
      'tob_sent',
      'surveyed',
      'reported',
      'invoice_sent',
      'survey_sent',
    ]);
    expect(isBuildingSurveyorPipelineStage('quoted')).toBe(true);
    expect(isBuildingSurveyorPipelineStage('lead')).toBe(false);
  });

  it('maps enquiry, quote sent, and accepted events', () => {
    expect(surveyorStageOnEnquiry()).toBe('enquiry');
    expect(surveyorStageOnQuoteSent()).toBe('quoted');
    expect(surveyorStageOnAccepted()).toBe('accepted');
    expect(publicFormPipelineStage('building-surveyor')).toBe('enquiry');
    expect(publicFormPipelineStage('work')).toBe('lead');
  });

  it('opens the Accepted gate on quote accept or signed Terms of Business', () => {
    expect(canOpenSurveyorAcceptedGate({})).toBe(false);
    expect(canOpenSurveyorAcceptedGate({ quoteAccepted: true })).toBe(true);
    expect(canOpenSurveyorAcceptedGate({ termsSigned: true })).toBe(true);
  });
});

describe('surveyorStageBlockedByTob', () => {
  it('blocks Report drafted and later until the terms are signed', () => {
    expect(surveyorStageBlockedByTob('reported', false)).toBe(true);
    expect(surveyorStageBlockedByTob('invoice_sent', false)).toBe(true);
    expect(surveyorStageBlockedByTob('survey_sent', false)).toBe(true);
    expect(surveyorStageBlockedByTob('reported', true)).toBe(false);
    expect(surveyorStageBlockedByTob('surveyed', false)).toBe(false);
  });

  it('never blocks non-surveyor stage keys', () => {
    for (const stage of ['won', 'lost', 'billed', 'completed', 'lead']) {
      expect(surveyorStageBlockedByTob(stage, false)).toBe(false);
    }
  });
});

describe('isBuildingSurveyorTerminalStage', () => {
  it('treats Survey sent and Lost as terminal', () => {
    expect(isBuildingSurveyorTerminalStage('survey_sent')).toBe(true);
    expect(isBuildingSurveyorTerminalStage('lost')).toBe(true);
    expect(isBuildingSurveyorTerminalStage('reported')).toBe(false);
    expect(isBuildingSurveyorTerminalStage('won')).toBe(false);
  });
});
