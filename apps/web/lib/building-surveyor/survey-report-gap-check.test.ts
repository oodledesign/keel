import { describe, expect, it } from 'vitest';

import {
  buildSurveyGapCheck,
  mergeSurveyGapFlags,
  parseSurveyGapCheckResponse,
} from './survey-report-gap-check';

const roof = {
  key: 'roof_coverings',
  ricsCode: 'D2',
  label: 'D2 Roof coverings',
  allowsPhotos: true,
  hasNotes: false,
  photoCount: 0,
};

describe('buildSurveyGapCheck', () => {
  it('flags empty sections, photos without text, and text without photos', () => {
    const result = buildSurveyGapCheck([
      roof,
      {
        ...roof,
        key: 'water',
        ricsCode: 'F3',
        label: 'F3 Water',
        photoCount: 2,
      },
      {
        ...roof,
        key: 'windows',
        ricsCode: 'E1',
        label: 'E1 Windows',
        hasNotes: true,
        photoCount: 0,
      },
    ]);

    expect(result.emptySectionCount).toBe(1);
    expect(result.photosWithoutTextCount).toBe(1);
    expect(result.textWithoutPhotosCount).toBe(1);
    expect(result.readyToPublish).toBe(false);
    expect(result.flags.map((flag) => flag.kind)).toEqual([
      'empty_section',
      'photos_without_text',
      'text_without_photos',
    ]);
  });

  it('is ready when notes and photos line up', () => {
    const result = buildSurveyGapCheck([
      { ...roof, hasNotes: true, photoCount: 1 },
    ]);
    expect(result.readyToPublish).toBe(true);
    expect(result.flags).toHaveLength(0);
  });

  it('does not demand photos on sections that do not allow them', () => {
    const result = buildSurveyGapCheck([
      {
        key: 'about_inspection',
        ricsCode: 'A',
        label: 'A About the inspection',
        allowsPhotos: false,
        hasNotes: true,
        photoCount: 0,
      },
    ]);
    expect(result.readyToPublish).toBe(true);
  });
});

describe('parseSurveyGapCheckResponse', () => {
  it('reads a flags array and drops rewrite-shaped rows', () => {
    const flags = parseSurveyGapCheckResponse({
      flags: [
        {
          kind: 'empty_section',
          sectionKey: 'water',
          ricsCode: 'F3',
          label: 'F3 Water',
          detail: 'No notes.',
        },
        {
          kind: 'empty_section',
          sectionKey: 'windows',
          detail: 'Rewrite this section with a full description.',
        },
        { kind: 'invented', sectionKey: 'roof_coverings' },
      ],
    });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.sectionKey).toBe('water');
  });

  it('parses a JSON string and ignores invalid payloads', () => {
    expect(parseSurveyGapCheckResponse('not-json')).toEqual([]);
    expect(
      parseSurveyGapCheckResponse(
        '[{"kind":"photos_without_text","sectionKey":"roof_coverings"}]',
      ),
    ).toHaveLength(1);
  });
});

describe('mergeSurveyGapFlags', () => {
  it('dedupes by kind and section', () => {
    const merged = mergeSurveyGapFlags(
      [
        {
          kind: 'empty_section',
          sectionKey: 'water',
          ricsCode: 'F3',
          label: 'F3',
          detail: 'empty',
        },
      ],
      [
        {
          kind: 'empty_section',
          sectionKey: 'water',
          ricsCode: 'F3',
          label: 'F3',
          detail: 'duplicate',
        },
        {
          kind: 'text_without_photos',
          sectionKey: 'water',
          ricsCode: 'F3',
          label: 'F3',
          detail: 'no photos',
        },
      ],
    );
    expect(merged).toHaveLength(2);
  });
});
