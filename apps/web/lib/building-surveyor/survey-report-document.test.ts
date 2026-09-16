import { describe, expect, it } from 'vitest';

import {
  documentFromObservations,
  documentFromSectionHtml,
  hydrateSurveyReportImageSrcs,
  importHtmlAsSurveyDocument,
  parseSurveyReportDocument,
  surveyReportDocumentHasContent,
} from './survey-report-document';

describe('documentFromObservations', () => {
  it('places observation text and curated photos under the matching section', () => {
    const document = documentFromObservations(
      [{ sectionKey: 'windows', body: 'Sash is stiff.' }],
      [
        {
          sectionKey: 'windows',
          title: 'Front elevation window',
          caption: 'Cracked putty to the lower sash.',
          documentId: '11111111-1111-4111-8111-111111111111',
          url: 'https://example.com/window.jpg',
        },
      ],
    );

    const heading = document.blocks.find(
      (block) => block.type === 'heading' && block.sectionKey === 'windows',
    );
    const text = document.blocks.find(
      (block) => block.type === 'text' && block.html.includes('Sash is stiff.'),
    );
    const image = document.blocks.find((block) => block.type === 'image');

    expect(heading).toBeDefined();
    expect(text).toBeDefined();
    expect(image).toMatchObject({
      type: 'image',
      src: 'https://example.com/window.jpg',
      caption: 'Cracked putty to the lower sash.',
      documentId: '11111111-1111-4111-8111-111111111111',
    });
    expect(surveyReportDocumentHasContent(document)).toBe(true);
  });
});

describe('documentFromSectionHtml', () => {
  it('keeps AI section html and appends curated photos after the text', () => {
    const document = documentFromSectionHtml(
      [{ key: 'main_walls', html: '<p>Diagonal cracking to the bay.</p>' }],
      [
        {
          sectionKey: 'main_walls',
          title: 'Bay crack',
          caption: 'Stepped crack above the lintel.',
          url: 'https://example.com/wall.jpg',
        },
      ],
    );

    const wallIndex = document.blocks.findIndex(
      (block) => block.type === 'heading' && block.sectionKey === 'main_walls',
    );
    expect(document.blocks[wallIndex + 1]).toMatchObject({
      type: 'text',
      html: '<p>Diagonal cracking to the bay.</p>',
    });
    expect(document.blocks[wallIndex + 2]).toMatchObject({
      type: 'image',
      caption: 'Stepped crack above the lintel.',
    });
  });
});

describe('importHtmlAsSurveyDocument', () => {
  it('splits legacy h2 sections into heading and text blocks', () => {
    const document = importHtmlAsSurveyDocument(
      '<h2 data-section="windows">Windows</h2>\n<p>Sash is stiff.</p>\n<h2 data-section="roof_coverings">Roof coverings</h2>\n<p></p>',
    );

    expect(
      document.blocks.filter((block) => block.type === 'heading'),
    ).toHaveLength(2);
    expect(
      document.blocks.some(
        (block) =>
          block.type === 'text' && block.html.includes('Sash is stiff.'),
      ),
    ).toBe(true);
  });
});

describe('parseSurveyReportDocument', () => {
  it('rejects campaign-only block types', () => {
    expect(
      parseSurveyReportDocument({
        version: 1,
        blocks: [{ id: '1', type: 'logo' }],
      }),
    ).toBeNull();
  });

  it('rejects non-http image sources', () => {
    expect(
      parseSurveyReportDocument({
        version: 1,
        blocks: [
          {
            id: 'img-1',
            type: 'image',
            src: 'javascript:alert(1)',
            alt: 'x',
          },
        ],
      }),
    ).toBeNull();
  });
});

describe('hydrateSurveyReportImageSrcs', () => {
  it('refreshes signed urls from document ids', () => {
    const document = documentFromObservations(
      [{ sectionKey: 'windows', body: 'Sash is stiff.' }],
      [
        {
          sectionKey: 'windows',
          title: 'Window',
          documentId: '11111111-1111-4111-8111-111111111111',
          url: 'https://expired.example/old.jpg',
        },
      ],
    );

    const hydrated = hydrateSurveyReportImageSrcs(document, {
      '11111111-1111-4111-8111-111111111111':
        'https://fresh.example/window.jpg',
    });
    const image = hydrated.blocks.find((block) => block.type === 'image');
    expect(image).toMatchObject({ src: 'https://fresh.example/window.jpg' });
  });
});
