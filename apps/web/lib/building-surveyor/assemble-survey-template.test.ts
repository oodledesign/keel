import { describe, expect, it } from 'vitest';

import { assembleSurveyReportFromTemplate } from './assemble-survey-template';
import { BUILDING_SURVEY_SECTIONS } from './rics-catalogue';
import { systemSurveyTemplate } from './survey-template';

describe('RICS catalogue', () => {
  it('covers L3 letters A–N and rated D1–G3 codes', () => {
    const letters = new Set(
      BUILDING_SURVEY_SECTIONS.map((item) => item.letter),
    );
    for (const letter of 'ABCDEFGHIJKLMN') {
      expect(letters.has(letter)).toBe(true);
    }

    const rated = BUILDING_SURVEY_SECTIONS.filter(
      (item) => item.allowsRating,
    ).map((item) => item.ricsCode);
    for (const code of [
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
      'D8',
      'D9',
      'E1',
      'E2',
      'E3',
      'E4',
      'E5',
      'E6',
      'E7',
      'E8',
      'E9',
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
      'F6',
      'F7',
      'G1',
      'G2',
      'G3',
    ]) {
      expect(rated).toContain(code);
    }
  });
});

describe('assembleSurveyReportFromTemplate', () => {
  it('fills merge, element content, rating badge and captioned photos for D2', () => {
    const document = assembleSurveyReportFromTemplate({
      template: systemSurveyTemplate('rics_hss_l3'),
      merge: {
        'property.address': '10 Drummond Hall, Penshurst',
        'client.name': 'Mr B Currie',
        'surveyor.name': 'Ben Carey',
      },
      observations: [
        {
          sectionKey: 'roof_coverings',
          ricsCode: 'D2',
          body: 'Coverings are generally sound.',
          conditionRating: '1',
        },
      ],
      photos: [
        {
          sectionKey: 'roof_coverings',
          ricsCode: 'D2',
          title: 'Rear pitch',
          caption: 'Rear pitch —',
          url: 'https://example.com/d2.jpg',
        },
      ],
    });

    const cover = document.blocks.find(
      (block) =>
        block.type === 'text' && block.html.includes('10 Drummond Hall'),
    );
    expect(cover).toBeDefined();

    const d2HeadingIndex = document.blocks.findIndex(
      (block) =>
        block.type === 'heading' &&
        'ricsCode' in block &&
        block.ricsCode === 'D2',
    );
    expect(d2HeadingIndex).toBeGreaterThan(0);
    expect(document.blocks[d2HeadingIndex - 1]).toMatchObject({
      type: 'image',
      caption: 'Rear pitch —',
    });
    expect(document.blocks[d2HeadingIndex]).toMatchObject({
      type: 'heading',
      conditionRating: '1',
      ricsCode: 'D2',
    });
    expect(document.blocks[d2HeadingIndex + 1]).toMatchObject({
      type: 'text',
      html: expect.stringContaining('Coverings are generally sound.'),
    });
  });

  it('builds a rating summary table from element ratings', () => {
    const document = assembleSurveyReportFromTemplate({
      template: systemSurveyTemplate('rics_hss_l3'),
      merge: {},
      observations: [
        {
          sectionKey: 'heating',
          ricsCode: 'F4',
          body: 'Boiler is dated.',
          conditionRating: '3',
        },
        {
          sectionKey: 'windows',
          ricsCode: 'D5',
          body: 'Sashes stiff.',
          conditionRating: '2',
        },
      ],
    });

    const summary = document.blocks.find(
      (block) =>
        block.type === 'text' && block.html.includes('Condition rating 3'),
    );
    expect(summary?.type === 'text' && summary.html).toMatch(/F4 Heating/i);
    expect(summary?.type === 'text' && summary.html).toMatch(/D5 Windows/i);
  });

  it('clones the L2 system template with J valuation instead of J1–J5', () => {
    const l2 = systemSurveyTemplate('rics_hss_l2');
    expect(l2.blocks.some((block) => block.ricsCode === 'J.valuation')).toBe(
      true,
    );
    expect(l2.blocks.some((block) => block.ricsCode === 'J1')).toBe(false);
    expect(l2.blocks.some((block) => block.ricsCode === 'D2')).toBe(true);
  });
});
