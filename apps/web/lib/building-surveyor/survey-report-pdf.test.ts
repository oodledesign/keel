import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRef,
} from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  buildProposalPdf,
  htmlToPlainText,
} from '~/home/[account]/proposals/_lib/server/proposal-pdf';

import {
  assembleSurveyReportFromTemplate,
  mergeValuesFromSurvey,
} from './assemble-survey-template';
import { documentFromObservations } from './survey-report-document';
import {
  type SurveyPdfImage,
  buildSurveyReportPdf,
  surveyHtmlToPdfItems,
} from './survey-report-pdf';
import { RICS_HSS_L3_TEMPLATE } from './survey-template';

describe('surveyHtmlToPdfItems', () => {
  it('labels merge fields and keeps table headers and bullets', () => {
    const items = surveyHtmlToPdfItems(
      '<p>Intro</p><ul><li>First</li></ul><table class="survey-merge-fields"><tr><th>client.name</th><td>Jane Doe</td></tr></table><table><tr><th>Room</th><th>Floor</th></tr><tr><td>Kitchen</td><td>Ground</td></tr></table>',
    );
    expect(items).toMatchObject([
      { kind: 'para', text: 'Intro', bold: false, bullet: false },
      { kind: 'para', text: 'First', bold: false, bullet: true },
      { kind: 'fields', rows: [["Client's name", 'Jane Doe']] },
      {
        kind: 'table',
        header: ['Room', 'Floor'],
        rows: [['Kitchen', 'Ground']],
        variant: 'generic',
      },
    ]);
  });

  it('turns dot lines into rules, "Label -" lines into bold sub-headings and hyphen lines into bullets', () => {
    const items = surveyHtmlToPdfItems(
      '<p>Left elevation -\n- Stepped cracking to render\n..........\nRight elevation:</p>',
    );
    expect(items).toMatchObject([
      { kind: 'para', text: 'Left elevation -', bold: true },
      { kind: 'para', text: 'Stepped cracking to render', bullet: true },
      { kind: 'rule' },
      { kind: 'para', text: 'Right elevation:', bold: true },
    ]);
  });

  it('keeps inline bold, italic and link runs and links bare URLs', () => {
    const [item] = surveyHtmlToPdfItems(
      '<p>See <strong>Terms</strong> and <em>notes</em> at <a href="https://rics.org/x">RICS</a> or www.gov.uk.</p>',
    );
    expect(item).toMatchObject({ kind: 'para' });
    const runs = item?.kind === 'para' ? item.runs : [];
    expect(runs).toContainEqual(
      expect.objectContaining({ text: 'Terms', bold: true }),
    );
    expect(runs).toContainEqual(
      expect.objectContaining({ text: 'notes', italic: true }),
    );
    expect(runs).toContainEqual(
      expect.objectContaining({ text: 'RICS', href: 'https://rics.org/x' }),
    );
    expect(runs).toContainEqual(
      expect.objectContaining({
        text: 'www.gov.uk',
        href: 'https://www.gov.uk',
      }),
    );
  });

  it('parses callouts, fields, checklists, documents, accommodation and diagrams', () => {
    const items = surveyHtmlToPdfItems(
      [
        '<aside class="survey-callout" data-variant="reminder"><h4>Reminder</h4><p>Read the terms.</p></aside>',
        '<section class="survey-field"><h4>Weather</h4></section>',
        '<div class="survey-checklist"><h4>Main services</h4><p>A marked box shows presence.</p><ul><li data-checked="true">☒ Gas</li><li data-checked="false">☐ Water</li></ul></div>',
        '<div class="survey-documents"><h3><span class="survey-rating-badge" data-rating="R">R</span> Documents we may suggest you request before you sign contracts</h3><p>Check these.</p><table class="survey-documents-table"><thead><tr><th>Element no.</th><th>Document name</th><th>Received</th></tr></thead><tbody><tr><td>1</td><td>EICR</td><td></td></tr></tbody></table></div>',
        '<table class="survey-accommodation"><thead><tr><th></th><th>Living</th></tr></thead><tbody><tr><th>Ground</th><td>2</td></tr></tbody></table>',
        '<table class="survey-rating-unrated"><tbody><tr><td>D1</td></tr></tbody></table>',
        '<figure class="survey-diagram" data-asset="typical-house"><img src="/brand/rics-typical-house.png" alt="" /></figure>',
      ].join(''),
    );
    expect(items).toMatchObject([
      {
        kind: 'callout',
        variant: 'reminder',
        title: 'Reminder',
        items: [{ kind: 'para', text: 'Read the terms.' }],
      },
      { kind: 'field', label: 'Weather', items: [{ text: 'n/a' }] },
      {
        kind: 'checklist',
        title: 'Main services',
        note: 'A marked box shows presence.',
        options: [
          { label: 'Gas', checked: true },
          { label: 'Water', checked: false },
        ],
      },
      {
        kind: 'documents',
        title: 'Documents we may suggest you request before you sign contracts',
        rows: [['1', 'EICR', '']],
      },
      {
        kind: 'table',
        variant: 'accommodation',
        header: ['', 'Living'],
        rows: [['Ground', '2']],
      },
      { kind: 'diagram', asset: 'typical-house' },
    ]);
  });
});

describe('buildSurveyReportPdf', () => {
  it('adds a cover, contents and a divider page per lettered section', async () => {
    const document = assembleSurveyReportFromTemplate({
      template: RICS_HSS_L3_TEMPLATE,
      merge: mergeValuesFromSurvey({ clientName: 'Jane Doe' }),
      observations: [
        {
          sectionKey: 'chimney_stacks',
          ricsCode: 'D1',
          body: 'Pointing is weathered.',
          conditionRating: '2',
        },
      ],
    });
    const sections = document.blocks.filter(
      (block) => block.type === 'heading' && block.level === 1,
    ).length;

    const bytes = await buildSurveyReportPdf({
      title: '106 Hadlow Road',
      document,
      brandName: 'Test Surveyors',
      brandColor: '#4A2C6A',
      surveyLevel: 3,
      reportLabel: 'RICS Home Survey - Level 3',
    });

    const pdf = await PDFDocument.load(bytes);
    expect(sections).toBeGreaterThan(10);
    expect(pdf.getPageCount()).toBeGreaterThan(2 + sections);
    expect(pdf.getTitle()).toBe('106 Hadlow Road');
  });

  it('links each contents row to its divider page and writes an outline', async () => {
    const document = assembleSurveyReportFromTemplate({
      template: RICS_HSS_L3_TEMPLATE,
      merge: mergeValuesFromSurvey({ clientName: 'Jane Doe' }),
      observations: [
        {
          sectionKey: 'chimney_stacks',
          ricsCode: 'D1',
          body: 'Pointing is weathered.',
          conditionRating: '2',
        },
      ],
    });
    const sectionTitles = document.blocks.flatMap((block) =>
      block.type === 'heading' &&
      block.level === 1 &&
      /^[A-Z] /.test(block.text)
        ? [block.text]
        : [],
    );

    const pdf = await PDFDocument.load(
      await buildSurveyReportPdf({ title: 'Report', document, surveyLevel: 3 }),
    );
    const pages = pdf.getPages();
    const contents = pages[1]!;
    const annots = contents.node.Annots();
    const targets = (annots?.asArray() ?? []).flatMap((ref) => {
      const annot = pdf.context.lookup(ref, PDFDict);
      const dest = annot.lookupMaybe(PDFName.of('Dest'), PDFArray);
      const target = dest?.get(0);
      return target instanceof PDFRef ? [target] : [];
    });

    expect(targets).toHaveLength(sectionTitles.length);
    const firstTarget = pages.findIndex((page) => page.ref === targets[0]);
    expect(firstTarget).toBeGreaterThan(1);

    const outlines = pdf.catalog.lookup(PDFName.of('Outlines'), PDFDict);
    const count = outlines.lookup(PDFName.of('Count'), PDFNumber).asNumber();
    expect(count).toBe(sectionTitles.length + 1);
  });

  it('embeds Noto Sans so typographic characters survive', async () => {
    const fontDir = path.join(__dirname, 'fonts');
    const read = (name: string) =>
      new Uint8Array(readFileSync(path.join(fontDir, name)));
    const document = documentFromObservations([
      {
        sectionKey: 'windows',
        body: 'The owner’s sashes – stiff • “ageing”.',
      },
    ]);

    const bytes = await buildSurveyReportPdf({
      title: 'Owner’s report',
      document,
      fonts: {
        regular: read('NotoSans-Regular.ttf'),
        bold: read('NotoSans-Bold.ttf'),
        italic: read('NotoSans-Italic.ttf'),
        boldItalic: read('NotoSans-BoldItalic.ttf'),
      },
      draft: true,
    });

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe('Owner’s report');
  });
});

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
  it('uses the chosen cover image instead of the first report photo', async () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const document = documentFromObservations(
      [{ sectionKey: 'windows', body: 'Sash is stiff.' }],
      [],
    );
    const input = {
      title: '106 Hadlow Road',
      document,
      brandName: 'Test Surveyors',
    };

    const coverImageCount = async (coverImage?: SurveyPdfImage) => {
      const bytes = await buildSurveyReportPdf({
        ...input,
        coverImage,
      });
      const pdf = await PDFDocument.load(bytes);
      const resources = pdf.getPage(0).node.Resources();
      const xObjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
      return xObjects?.keys().length ?? 0;
    };

    expect(await coverImageCount(undefined)).toBe(0);
    expect(await coverImageCount({ bytes: png, kind: 'png' })).toBe(1);
  });
});
