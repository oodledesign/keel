import { describe, expect, it } from 'vitest';

import { compileSurveyReportDocument } from './compile-survey-report-document';
import { documentFromObservations } from './survey-report-document';

describe('compileSurveyReportDocument', () => {
  it('emits sectioned html with figure captions for photos', () => {
    const html = compileSurveyReportDocument(
      documentFromObservations(
        [{ sectionKey: 'windows', body: 'Sash is stiff.' }],
        [
          {
            sectionKey: 'windows',
            title: 'Front elevation window',
            caption: 'Cracked putty to the lower sash.',
            url: 'https://example.com/window.jpg',
          },
        ],
      ),
    );

    expect(html).toContain('ozer-survey-report-document:v1');
    expect(html).toContain('data-section="windows"');
    expect(html).toContain('Sash is stiff.');
    expect(html).toContain('<img src="https://example.com/window.jpg"');
    expect(html).toContain('Cracked putty to the lower sash.');
  });

  it('keeps rating tables and badges that campaign rich-text would strip', () => {
    const html = compileSurveyReportDocument({
      version: 1,
      blocks: [
        {
          id: 'summary',
          type: 'text',
          html: '<h3>Condition rating 3</h3><table><tbody><tr><td>F4 Heating</td></tr></tbody></table><span class="survey-rating-badge" data-rating="3">3</span>',
        },
      ],
    });

    expect(html).toContain('<table>');
    expect(html).toContain('F4 Heating');
    expect(html).toContain('survey-rating-badge');
    expect(html).not.toMatch(/<script/i);
  });
});
