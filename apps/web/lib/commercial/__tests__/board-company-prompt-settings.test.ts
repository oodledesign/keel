import { describe, expect, it } from 'vitest';

import {
  isBoardPromptEnabled,
  parseCommercialBoardSettings,
  serializeCommercialBoardSettings,
} from '../board-company-settings';

const BRANCH_A = '11111111-1111-4111-8111-111111111111';
const BRANCH_B = '22222222-2222-4222-8222-222222222222';

describe('board prompt settings', () => {
  it('prompts by default, including for settings saved before the switch existed', () => {
    const settings = parseCommercialBoardSettings({ email: 'boards@x.com' });
    expect(settings.promptEnabled).toBe(true);
    expect(settings.promptOffBranchIds).toEqual([]);
    expect(isBoardPromptEnabled(settings, BRANCH_A)).toBe(true);
    expect(isBoardPromptEnabled(settings, null)).toBe(true);
  });

  it('stops prompting everywhere when the workspace switch is off', () => {
    const settings = parseCommercialBoardSettings({ promptEnabled: false });
    expect(isBoardPromptEnabled(settings, BRANCH_A)).toBe(false);
    expect(isBoardPromptEnabled(settings, null)).toBe(false);
  });

  it('stops prompting only for offices switched off', () => {
    const settings = parseCommercialBoardSettings({
      promptOffBranchIds: [BRANCH_A],
    });
    expect(isBoardPromptEnabled(settings, BRANCH_A)).toBe(false);
    expect(isBoardPromptEnabled(settings, BRANCH_B)).toBe(true);
    expect(isBoardPromptEnabled(settings, null)).toBe(true);
  });

  it('round-trips through serialize and ignores junk in the office list', () => {
    const parsed = parseCommercialBoardSettings({
      promptEnabled: false,
      promptOffBranchIds: [BRANCH_A, BRANCH_A, 42, '  '],
    });
    expect(parsed.promptOffBranchIds).toEqual([BRANCH_A]);
    const again = parseCommercialBoardSettings(
      serializeCommercialBoardSettings(parsed),
    );
    expect(again.promptEnabled).toBe(false);
    expect(again.promptOffBranchIds).toEqual([BRANCH_A]);
  });
});
