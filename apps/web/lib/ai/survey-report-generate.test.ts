import { describe, expect, it } from 'vitest';

import { parseGeneratedDocument } from './survey-report-generate-parse';

const SECTION_KEYS = [
  'about_inspection',
  'overall_opinion',
  'about_property',
  'chimney_stacks',
  'roof_coverings',
  'rainwater',
  'main_walls',
  'windows',
];

describe('parseGeneratedDocument', () => {
  it('assembles JSON sections and inserts curated photo blocks', () => {
    const sections = SECTION_KEYS.map((key) => ({
      key,
      html: `<p>Notes for ${key}.</p>`,
    }));
    const document = parseGeneratedDocument(JSON.stringify({ sections }), [
      {
        sectionKey: 'windows',
        title: 'Bay sash',
        caption: 'Cracked putty.',
        documentId: '11111111-1111-4111-8111-111111111111',
        url: 'https://example.com/window.jpg',
      },
    ]);

    expect(document).not.toBeNull();
    const image = document?.blocks.find((block) => block.type === 'image');
    expect(image).toMatchObject({
      type: 'image',
      caption: 'Cracked putty.',
      src: 'https://example.com/window.jpg',
    });
    expect(
      document?.blocks.some(
        (block) =>
          block.type === 'text' && block.html.includes('Notes for windows.'),
      ),
    ).toBe(true);
  });

  it('imports legacy HTML drafts', () => {
    const html = SECTION_KEYS.map(
      (key) => `<h2 data-section="${key}">${key}</h2><p>Body ${key}</p>`,
    ).join('\n');
    const document = parseGeneratedDocument(html, []);
    expect(document).not.toBeNull();
    expect(
      document?.blocks.filter((block) => block.type === 'heading').length,
    ).toBeGreaterThanOrEqual(8);
  });
});
