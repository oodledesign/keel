import { describe, expect, it } from 'vitest';

import { heuristicStyleNotes, isSurveyStyleMime } from './style-extract';
import { extractStyleDocumentText } from './style-extract.server';

describe('isSurveyStyleMime', () => {
  it('accepts PDF, DOCX, HTML and text', () => {
    expect(isSurveyStyleMime('application/pdf', 'report.pdf')).toBe(true);
    expect(
      isSurveyStyleMime(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'report.docx',
      ),
    ).toBe(true);
    expect(isSurveyStyleMime('text/html', 'report.html')).toBe(true);
    expect(isSurveyStyleMime('image/jpeg', 'photo.jpg')).toBe(false);
  });
});

describe('extractStyleDocumentText', () => {
  it('strips HTML and keeps British report wording', () => {
    const text = extractStyleDocumentText({
      filename: 'sample.html',
      mimeType: 'text/html',
      buffer: Buffer.from(
        '<html><body><h1>Roof coverings</h1><p>The covering is generally sound.</p></body></html>',
      ),
    });

    expect(text).toMatch(/Roof coverings/);
    expect(text).toMatch(/generally sound/);
    expect(text).not.toMatch(/<p>/);
  });

  it('reads plain text', () => {
    const text = extractStyleDocumentText({
      filename: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('We recommend further investigation of the damp.'),
    });

    expect(text).toMatch(/further investigation/);
  });
});

describe('heuristicStyleNotes', () => {
  it('mentions condition ratings when present', () => {
    const notes = heuristicStyleNotes(
      'The roof covering is generally sound. Condition rating 2 applies to the rear pitch. We recommend localised repairs.',
    );

    expect(notes).toMatch(/condition ratings/i);
    expect(notes).toMatch(/recommendation/i);
    expect(notes).toMatch(/British English/);
  });
});
