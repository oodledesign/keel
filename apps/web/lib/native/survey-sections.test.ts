import { describe, expect, it } from 'vitest';

import { NativeHttpError } from './http';
import {
  SURVEY_SECTION_NOTE_DIVIDER,
  appendSurveySectionNote,
  mapNativeOnSiteSections,
  requireOnSiteSurveySection,
  resolveOnSiteSurveySection,
  stripSurveySpeakerLabels,
} from './survey-sections';

describe('stripSurveySpeakerLabels', () => {
  it('strips ATX speaker headings and keeps the prose', () => {
    expect(
      stripSurveySpeakerLabels(
        '## Me\n\nThe stopcock is stiff.\n\n## Speaker 1\n\nThe kitchen window is cracked.',
      ),
    ).toBe('The stopcock is stiff.\n\nThe kitchen window is cracked.');
  });

  it('strips Me / Speaker prefixes but not ordinary labelled notes', () => {
    expect(
      stripSurveySpeakerLabels(
        'Me: The stopcock is stiff.\n\nSpeaker 1: Supply is copper.',
      ),
    ).toBe('The stopcock is stiff.\n\nSupply is copper.');
    expect(
      stripSurveySpeakerLabels('Them: The neighbour mentioned damp.'),
    ).toBe('The neighbour mentioned damp.');
    expect(stripSurveySpeakerLabels('Kitchen: the tap drips.')).toBe(
      'Kitchen: the tap drips.',
    );
    expect(stripSurveySpeakerLabels('The sash on the landing is stiff.')).toBe(
      'The sash on the landing is stiff.',
    );
  });

  it('returns empty when the take is only speaker labels or whitespace', () => {
    expect(stripSurveySpeakerLabels('## Me')).toBe('');
    expect(stripSurveySpeakerLabels('  **Them**  \n\n')).toBe('');
    expect(stripSurveySpeakerLabels('')).toBe('');
  });
});

describe('appendSurveySectionNote', () => {
  it('uses a four-em-dash divider that is not a speaker heading', () => {
    expect(SURVEY_SECTION_NOTE_DIVIDER).toBe('\u2014'.repeat(4));
    expect(SURVEY_SECTION_NOTE_DIVIDER).not.toMatch(/Me|Speaker|#/);
  });

  it('appends a later visit onto the same running note with a divider', () => {
    expect(appendSurveySectionNote('', 'Stopcock is stiff.')).toBe(
      'Stopcock is stiff.',
    );
    expect(appendSurveySectionNote('  ', 'Stopcock is stiff.')).toBe(
      'Stopcock is stiff.',
    );
    expect(
      appendSurveySectionNote(
        'Stopcock is stiff.',
        'Supply pipework is copper.',
      ),
    ).toBe(
      `Stopcock is stiff.\n\n${SURVEY_SECTION_NOTE_DIVIDER}\n\nSupply pipework is copper.`,
    );
  });

  it('does not insert an orphan divider for empty or whitespace takes', () => {
    expect(appendSurveySectionNote('Stopcock is stiff.', '')).toBe(
      'Stopcock is stiff.',
    );
    expect(appendSurveySectionNote('Stopcock is stiff.', '   \n')).toBe(
      'Stopcock is stiff.',
    );
    expect(appendSurveySectionNote('', '')).toBe('');
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
