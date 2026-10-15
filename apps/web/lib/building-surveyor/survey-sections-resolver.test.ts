import { describe, expect, it } from 'vitest';

import {
  isCustomSectionKey,
  isResolvableSectionKey,
  parseSectionOverrides,
  resolveSurveySections,
  slugifyCustomSectionKey,
  snapshotResolvedSections,
} from './survey-sections-resolver';

describe('survey-sections-resolver', () => {
  it('returns the built-in catalogue when overrides are null', () => {
    const resolved = resolveSurveySections({ level: 2, overrides: null });
    expect(resolved.length).toBeGreaterThan(10);
    expect(resolved.every((item) => !item.isCustom)).toBe(true);
    expect(resolved.find((item) => item.key === 'roof_coverings')).toBeTruthy();
  });

  it('renames a catalogue section', () => {
    const resolved = resolveSurveySections({
      level: 2,
      overrides: [{ key: 'roof_coverings', heading: 'Roof coverings (tiles)' }],
    });
    const roof = resolved.find((item) => item.key === 'roof_coverings');
    expect(roof?.heading).toBe('Roof coverings (tiles)');
    expect(roof?.renamed).toBe(true);
  });

  it('hides a catalogue section while keeping custom data keys resolvable', () => {
    const resolved = resolveSurveySections({
      level: 2,
      overrides: [{ key: 'conservatory_porches', hidden: true }],
    });
    expect(
      resolved.find((item) => item.key === 'conservatory_porches'),
    ).toBeUndefined();
    expect(isResolvableSectionKey('conservatory_porches')).toBe(true);
  });

  it('adds a custom section with custom_<slug> key', () => {
    const key = slugifyCustomSectionKey('Security and alarms');
    expect(key).toBe('custom_security_and_alarms');
    expect(isCustomSectionKey(key)).toBe(true);

    const resolved = resolveSurveySections({
      level: 2,
      overrides: [
        {
          key,
          heading: 'Security and alarms',
          onSitePickable: true,
          allowsPhotos: true,
          order: 50,
        },
      ],
    });
    const custom = resolved.find((item) => item.key === key);
    expect(custom?.isCustom).toBe(true);
    expect(custom?.heading).toBe('Security and alarms');
    expect(custom?.onSitePickable).toBe(true);
  });

  it('resets to default when overrides are empty', () => {
    const withCustom = resolveSurveySections({
      level: 2,
      overrides: [{ key: 'custom_foo', heading: 'Foo' }],
    });
    expect(withCustom.some((item) => item.isCustom)).toBe(true);

    const reset = resolveSurveySections({ level: 2, overrides: [] });
    expect(reset.every((item) => !item.isCustom)).toBe(true);
    expect(reset.length).toBe(
      resolveSurveySections({ level: 2, overrides: null }).length,
    );
  });

  it('reorders by override order', () => {
    const resolved = resolveSurveySections({
      level: 2,
      overrides: [
        { key: 'water', order: 0 },
        { key: 'electricity', order: 1 },
      ],
    });
    const waterIndex = resolved.findIndex((item) => item.key === 'water');
    const electricityIndex = resolved.findIndex(
      (item) => item.key === 'electricity',
    );
    expect(waterIndex).toBeGreaterThanOrEqual(0);
    expect(electricityIndex).toBeGreaterThanOrEqual(0);
    expect(waterIndex).toBeLessThan(electricityIndex);
  });

  it('snapshots resolved sections for proposals.survey_sections', () => {
    const resolved = resolveSurveySections({
      level: 2,
      overrides: [{ key: 'custom_security', heading: 'Security' }],
    });
    const snap = snapshotResolvedSections(resolved);
    expect(snap.some((item) => item.key === 'custom_security')).toBe(true);
    expect(parseSectionOverrides(snap)?.length).toBe(snap.length);
  });
});
