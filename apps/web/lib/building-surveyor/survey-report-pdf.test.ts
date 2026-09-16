import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  buildProposalPdf,
  htmlToPlainText,
} from '~/home/[account]/proposals/_lib/server/proposal-pdf';

import { documentFromObservations } from './survey-report-document';

describe('htmlToPlainText', () => {
  it('keeps list markers and headings', () => {
    const text = htmlToPlainText(
      '<h2>Windows</h2><p>Sash is stiff.</p><ul><li>Putty</li></ul>',
    );
    expect(text).toContain('Windows');
    expect(text).toContain('• Putty');
  });
});

describe('buildProposalPdf', () => {
  it('renders a survey report across more than one page instead of clipping', async () => {
    const document = documentFromObservations(
      Array.from({ length: 20 }, (_, index) => ({
        sectionKey: index % 2 === 0 ? 'windows' : 'main_walls',
        body: `Observation ${index + 1}. ${'The surveyor recorded a defect that needs a full paragraph of explanation. '.repeat(6)}`,
      })),
    );

    const bytes = await buildProposalPdf({
      title: '106 Hadlow Road',
      status: 'draft',
      kind: 'survey_report',
      content_html: '',
      body_document: document,
      brand_name: 'Test Surveyors',
      recipient_name: 'Test Company',
    });

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(bytes.byteLength).toBeGreaterThan(4_000);
  });

  it('embeds curated survey photos instead of dropping them', async () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const documentId = '11111111-1111-4111-8111-111111111111';
    const document = documentFromObservations(
      [{ sectionKey: 'windows', body: 'Sash is stiff.' }],
      [
        {
          sectionKey: 'windows',
          title: 'Front elevation window',
          caption: 'Cracked putty to the lower sash.',
          documentId,
          url: 'https://example.com/expired.jpg',
        },
      ],
    );

    const withImage = await buildProposalPdf({
      title: '106 Hadlow Road',
      status: 'draft',
      kind: 'survey_report',
      content_html: '',
      body_document: document,
      brand_name: 'Test Surveyors',
      imageBytesById: { [documentId]: png },
    });
    const withoutImage = await buildProposalPdf({
      title: '106 Hadlow Road',
      status: 'draft',
      kind: 'survey_report',
      content_html: '',
      body_document: document,
      brand_name: 'Test Surveyors',
    });

    expect(withImage.byteLength).toBeGreaterThan(withoutImage.byteLength);
  });
});
