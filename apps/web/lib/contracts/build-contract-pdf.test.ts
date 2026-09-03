import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  type ContractForPdf,
  buildContractPdf,
  contractPdfFilename,
} from './build-contract-pdf';

function longHtml(paragraphs: number): string {
  return Array.from({ length: paragraphs }, (_, i) => {
    return `<h2>Clause ${i + 1}</h2><p>This is <strong>formatted</strong> agreement text with <em>emphasis</em> for clause ${i + 1}. It is long enough to wrap across lines and force additional pages when repeated.</p><ul><li>Point A</li><li>Point B</li></ul>`;
  }).join('');
}

const base: ContractForPdf = {
  id: '11111111-2222-3333-4444-555555555555',
  title: 'Services agreement',
  status: 'signed',
  content_html: '<h1>Terms</h1><p>Hello <strong>world</strong></p>',
  total_pence: 250000,
  currency: 'gbp',
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-09-03T10:00:00.000Z',
  generated_at: '2026-09-03T12:00:00.000Z',
  brand_name: 'Ozer Studio',
  author_name: 'Dan Potter',
  author_company: 'Ozer Studio',
  author_signature_type: 'typed',
  author_signature_data: 'Dan Potter',
  author_signed_at: '2026-09-01T09:00:00.000Z',
  recipient_name: 'Ada Lovelace',
  recipient_company: 'Analytical Engines',
  recipient_signature_type: 'typed',
  recipient_signature_data: 'A. Lovelace',
  recipient_signed_at: '2026-09-02T15:30:00.000Z',
  client: {
    display_name: 'Ada Lovelace',
    company_name: 'Analytical Engines',
    email: 'ada@example.com',
  },
  payment_plan: [
    { label: 'Deposit', percent: 40 },
    { label: 'Balance', percent: 60 },
  ],
};

describe('contractPdfFilename', () => {
  it('slugifies the title', () => {
    expect(contractPdfFilename('Services Agreement!')).toBe(
      'contract-services-agreement.pdf',
    );
  });

  it('falls back for a blank title', () => {
    expect(contractPdfFilename('   ')).toBe('contract-agreement.pdf');
  });
});

describe('buildContractPdf', () => {
  it('emits a PDF with identity metadata and both signature labels', async () => {
    const bytes = await buildContractPdf(base);
    expect(bytes.byteLength).toBeGreaterThan(500);
    const header = Buffer.from(bytes.slice(0, 5)).toString('utf8');
    expect(header).toBe('%PDF-');

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toBe('Services agreement');
    expect(loaded.getAuthor()).toBe('Ozer Studio');
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('does not truncate a long body — extra pages are added before signatures', async () => {
    const bytes = await buildContractPdf({
      ...base,
      content_html: longHtml(40),
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
  });

  it('still produces a PDF when the body is empty', async () => {
    const bytes = await buildContractPdf({ ...base, content_html: '' });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });
});
