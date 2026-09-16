import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseGoreportRows, parseGoreportXlsx } from './goreport-import';
import { mapGoreportPath } from './goreport-rics-map';
import { parsePhraseTokens, resolvePhraseBody } from './phrase-tokens';
import { buildMinimalXlsx } from './xlsx-min';

const SAMPLE_ROWS = [
  { a: 'checksum:333932362d37', b: '', c: '' },
  { a: '(589) D Outside the property > D2 Roof coverings', b: '', c: '' },
  { a: 'Title', b: 'Text', c: 'Path' },
  {
    a: 'Slipped slates',
    b: 'There are slipped slates to the ||front/rear|| pitch ||describe||.',
    c: '/',
  },
  {
    a: '(480) A About the Inspection  > Weather conditions when the inspections took place',
    b: '',
    c: '',
  },
  { a: 'Title', b: 'Text', c: 'Path' },
  {
    a: 'Weather',
    b: 'The weather at the time of the inspection was ||*overcast/cold/hot||.',
    c: '/Weather',
  },
];

const BANK_FILES = [
  [
    'caroline_l2',
    '/home/ubuntu/.cursor/projects/workspace/uploads/Caroline_-_Level_2_e734.xlsx',
    { minPhrases: 500, d2: true, level: 'l2' as const },
  ],
  [
    'caroline_l3',
    '/home/ubuntu/.cursor/projects/workspace/uploads/Caroline_-_Level_3_0bf3.xlsx',
    { minPhrases: 1500, d2: true, level: 'l3' as const },
  ],
  [
    'tyson_l2',
    '/home/ubuntu/.cursor/projects/workspace/uploads/Tyson_-_Level_2_4cab.xlsx',
    { minPhrases: 800, d2: true, level: 'l2' as const },
  ],
  [
    'tyson_l3',
    '/home/ubuntu/.cursor/projects/workspace/uploads/Tyson_-_Level_3_ef5a.xlsx',
    { minPhrases: 1400, d2: true, level: 'l3' as const },
  ],
] as const;

describe('mapGoreportPath', () => {
  it('maps element codes D1–G3 and H/I/J subs', () => {
    expect(
      mapGoreportPath('(589) D Outside > D2 Roof coverings'),
    ).toMatchObject({
      ricsCode: 'D2',
      sectionKey: 'roof_coverings',
      fieldId: '589',
    });
    expect(mapGoreportPath('(1) G Grounds > G1 Garage')).toMatchObject({
      ricsCode: 'G1',
      sectionKey: 'garage_outbuildings',
    });
    expect(
      mapGoreportPath('(2) H Issues for your legal advisers > H2 Guarantees'),
    ).toMatchObject({ ricsCode: 'H2', sectionKey: 'legal_guarantees' });
    expect(
      mapGoreportPath('(3) J Energy Matters > J1 Insulation'),
    ).toMatchObject({
      ricsCode: 'J1',
      sectionKey: 'energy',
    });
  });

  it('maps A/B/C and L2 valuation fields without inventing element codes', () => {
    expect(
      mapGoreportPath(
        '(480) A About the Inspection  > Weather conditions when the inspections took place',
      ),
    ).toMatchObject({ ricsCode: 'A.weather', sectionKey: 'weather' });
    expect(
      mapGoreportPath(
        '(498) B Overall opinion and summary of the condition ratings > Overall opinion of the property',
      ),
    ).toMatchObject({ ricsCode: 'B', sectionKey: 'overall_opinion' });
    expect(
      mapGoreportPath('(510) C About the property > Type of property'),
    ).toMatchObject({ ricsCode: 'C.type', sectionKey: 'property_type' });
    expect(
      mapGoreportPath('(679) J Valuation  > Area of property (sq m)'),
    ).toMatchObject({ ricsCode: 'J.valuation', sectionKey: 'valuation' });
    expect(mapGoreportPath('(687) Note Pad')).toMatchObject({
      ricsCode: 'notes',
      sectionKey: 'notepad',
    });
  });
});

describe('parseGoreportRows', () => {
  it('skips checksum and Title/Text/Path rows, then maps phrases', () => {
    const result = parseGoreportRows(SAMPLE_ROWS);
    expect(result.skippedChecksum).toBe(true);
    expect(result.fieldCount).toBe(2);
    expect(result.phrases).toHaveLength(2);
    expect(result.phrases[0]).toMatchObject({
      title: 'Slipped slates',
      ricsCode: 'D2',
      sectionKey: 'roof_coverings',
    });
    expect(result.phrases[1]).toMatchObject({
      title: 'Weather',
      ricsCode: 'A.weather',
      nestedPath: '/Weather',
    });
  });
});

describe('parseGoreportXlsx', () => {
  it('reads a generated Predefined Responses workbook', () => {
    const xlsx = buildMinimalXlsx([
      ['checksum:demo'],
      ['(589) D Outside the property > D2 Roof coverings'],
      ['Title', 'Text', 'Path'],
      ['Slipped slates', 'A few slipped slates.', '/'],
    ]);
    const result = parseGoreportXlsx(xlsx);
    expect(result.phrases).toEqual([
      expect.objectContaining({
        title: 'Slipped slates',
        body: 'A few slipped slates.',
        ricsCode: 'D2',
      }),
    ]);
  });

  it.each(BANK_FILES)(
    'parses %s GoReport bank against RICS codes',
    (_name, filePath, expectShape) => {
      if (!existsSync(filePath)) return;
      const result = parseGoreportXlsx(readFileSync(filePath));
      expect(result.skippedChecksum).toBe(true);
      expect(result.phrases.length).toBeGreaterThan(expectShape.minPhrases);
      expect(result.fields.some((item) => item.ricsCode === 'D2')).toBe(true);
      expect(result.fields.some((item) => item.ricsCode === 'D1')).toBe(true);
      expect(result.fields.some((item) => item.ricsCode === 'E8')).toBe(true);
      expect(result.fields.some((item) => item.ricsCode === 'F4')).toBe(true);
      expect(result.fields.some((item) => item.ricsCode === 'G1')).toBe(true);
      expect(result.phrases.every((item) => item.title && item.body)).toBe(
        true,
      );
      if (expectShape.level === 'l3') {
        expect(result.fields.some((item) => item.ricsCode === 'J1')).toBe(true);
      } else {
        expect(
          result.fields.some((item) => item.ricsCode === 'J.valuation'),
        ).toBe(true);
      }
    },
  );
});

describe('phrase tokens', () => {
  it('turns ||a/b|| into choices and ||describe|| into blanks', () => {
    const tokens = parsePhraseTokens(
      'The weather was ||*overcast/cold/hot|| and ||describe||.',
    );
    expect(tokens.filter((token) => token.type === 'choice')).toEqual([
      expect.objectContaining({
        options: ['overcast', 'cold', 'hot'],
        defaultIndex: 0,
      }),
    ]);
    expect(tokens.filter((token) => token.type === 'describe')).toEqual([
      expect.objectContaining({ label: 'describe' }),
    ]);
    expect(
      resolvePhraseBody(
        'The weather was ||*overcast/cold/hot|| and ||describe||.',
        ['cold', 'showery'],
      ),
    ).toBe('The weather was cold and showery.');
  });
});
