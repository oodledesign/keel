import { describe, expect, it } from 'vitest';

import {
  parsePublishingSettingsTab,
  publishingSettingsTabHash,
  publishingSettingsTabHref,
} from '../publishing-settings-tabs';

describe('parsePublishingSettingsTab', () => {
  it('accepts tab ids and the board-company hash', () => {
    expect(parsePublishingSettingsTab('website')).toBe('website');
    expect(parsePublishingSettingsTab('portals')).toBe('portals');
    expect(parsePublishingSettingsTab('sync')).toBe('sync');
    expect(parsePublishingSettingsTab('boards')).toBe('boards');
    expect(parsePublishingSettingsTab('board-company')).toBe('boards');
    expect(parsePublishingSettingsTab('#board-company')).toBe('boards');
  });

  it('rejects empty and unknown values', () => {
    expect(parsePublishingSettingsTab(null)).toBeNull();
    expect(parsePublishingSettingsTab('')).toBeNull();
    expect(parsePublishingSettingsTab('#')).toBeNull();
    expect(parsePublishingSettingsTab('billing')).toBeNull();
  });
});

describe('publishing settings tab links', () => {
  it('deep-links Boards to the board-company hash', () => {
    expect(publishingSettingsTabHash('boards')).toBe('board-company');
    expect(publishingSettingsTabHref('boards')).toBe(
      '?tab=boards#board-company',
    );
    expect(publishingSettingsTabHref('sync')).toBe('?tab=sync#sync');
  });
});
