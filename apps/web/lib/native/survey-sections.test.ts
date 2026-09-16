import { describe, expect, it } from 'vitest';

import { NativeHttpError } from './http';
import {
  appendSurveySectionNote,
  mapNativeOnSiteSections,
  requireOnSiteSurveySection,
  resolveOnSiteSurveySection,
} from './survey-sections';

describe('appendSurveySectionNote', () => {
  it('appends a later visit onto the same running note', () => {
    expect(appendSurveySectionNote('', 'Stopcock is stiff.')).toBe(
      'Stopcock is stiff.',
    );
    expect(
      appendSurveySectionNote(
        'Stopcock is stiff.',
        'Supply pipework is copper.',
      ),
    ).toBe('Stopcock is stiff.\n\nSupply pipework is copper.');
  });
});

describe('resolveOnSiteSurveySection', () => {
  it('resolves F3 Water and D2 Roof coverings from code or key', () => {
    expect(resolveOnSiteSurveySection('F3')?.key).toBe('water');
    expect(resolveOnSiteSurveySection('water')?.ricsCode).toBe('F3');
    expect(resolveOnSiteSurveySection('D2')?.key).toBe('roof_coverings');
  });

  it('rejects desk-only chapters and unknown codes', () => {
    expect(requireOnSiteSurveySection('F3').onSitePickable).toBe(true);
    expect(() => requireOnSiteSurveySection('A')).toThrow(NativeHttpError);
    expect(() => requireOnSiteSurveySection('bedroom')).toThrow(
      NativeHttpError,
    );
  });
});

describe('mapNativeOnSiteSections', () => {
  it('exposes on-site sections with accumulated notes, not rooms or chapters', () => {
    const sections = mapNativeOnSiteSections({
      level: 2,
      notesByCode: new Map([['F3', 'Stopcock is under the sink.']]),
      photoCountByKey: new Map([['water', 2]]),
    });
    const codes = sections.map((item) => item.rics_code);

    expect(codes).toContain('F3');
    expect(codes).toContain('D2');
    expect(codes).not.toContain('A');
    expect(codes).not.toContain('K');
    expect(sections.find((item) => item.rics_code === 'F3')).toMatchObject({
      key: 'water',
      label: 'F3 Water',
      note: 'Stopcock is under the sink.',
      photo_count: 2,
    });
  });
});
