import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUILDING_SURVEYOR_BOARD_NAME,
  displayBuildingSurveyorBoardName,
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
