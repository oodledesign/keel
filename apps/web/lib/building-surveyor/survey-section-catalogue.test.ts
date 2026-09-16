import { describe, expect, it } from 'vitest';

import { BUILDING_SURVEY_SECTIONS } from './report-sections';
import {
  SURVEY_SECTION_CATALOGUE,
  onSiteCaptureSections,
  sectionsVisibleAtLevel,
  surveySectionByRicsCode,
  surveySectionDisplayLabel,
} from './survey-section-catalogue';

describe('survey section catalogue', () => {
  it('keeps one catalogue with L2 / L3 visibility flags', () => {
    expect(SURVEY_SECTION_CATALOGUE.length).toBeGreaterThan(40);

    const water = surveySectionByRicsCode('F3');
    expect(water?.key).toBe('water');
    expect(water?.heading).toBe('Water');
    expect(water?.kind).toBe('sub_item');
    expect(water?.visibleOnLevels).toEqual([2, 3]);
    expect(water?.onSitePickable).toBe(true);
    expect(surveySectionDisplayLabel(water!)).toBe('F3 Water');
  });

  it('hides L3-only energy fields on Level 2 and L2 valuation on Level 3', () => {
    const l2 = sectionsVisibleAtLevel(2);
    const l3 = sectionsVisibleAtLevel(3);

    expect(l2.some((item) => item.ricsCode === 'J.valuation')).toBe(true);
    expect(l3.some((item) => item.ricsCode === 'J.valuation')).toBe(false);

    expect(l2.some((item) => item.ricsCode === 'J1')).toBe(false);
    expect(l3.some((item) => item.ricsCode === 'J1')).toBe(true);

    expect(l2.some((item) => item.ricsCode === 'F3')).toBe(true);
    expect(l3.some((item) => item.ricsCode === 'F3')).toBe(true);
  });

  it('exposes on-site pickable sections, not rooms or chapters', () => {
    const capture = onSiteCaptureSections(3);
    const codes = capture.map((item) => item.ricsCode);

    expect(codes).toContain('D2');
    expect(codes).toContain('F3');
    expect(codes).toContain('E3');
    expect(codes).not.toContain('A');
    expect(codes).not.toContain('K');
    expect(capture.every((item) => item.kind === 'sub_item')).toBe(true);
    expect(
      capture.some((item) => /bedroom|kitchen|bathroom room/i.test(item.key)),
    ).toBe(false);
  });

  it('dual-writes onto the Phase 1–2 section keys that already exist', () => {
    const legacyKeys = new Set(BUILDING_SURVEY_SECTIONS.map((item) => item.key));
    const overlapping = SURVEY_SECTION_CATALOGUE.filter((item) =>
      legacyKeys.has(item.key),
    );

    expect(overlapping.map((item) => item.key)).toEqual(
      expect.arrayContaining([
        'windows',
        'roof_coverings',
        'water',
        'heating',
        'energy',
      ]),
    );
    expect(overlapping.length).toBe(legacyKeys.size);
  });
});
