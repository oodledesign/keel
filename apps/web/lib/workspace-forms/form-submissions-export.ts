import { PDFDocument, type PDFFont, StandardFonts, rgb } from 'pdf-lib';

import { buildCsvDocument } from '~/lib/csv/build-csv';
import { sanitizePdfText } from '~/lib/invoices/pdf-text';
import type { WorkspaceFormField } from '~/lib/workspace-forms/form-fields';
import {
  type SubmissionColumnId,
  type SubmissionViewRecord,
  listSubmissionColumnOptions,
  sanitizeSubmissionColumnIds,
  selectUniqueSubmissions,
  submissionBuiltinValue,
  submissionFieldValue,
  submissionRecordLabel,
} from '~/lib/workspace-forms/form-submissions-view';

export const SUBMISSION_EXPORT_FORMATS = ['csv', 'pdf'] as const;
export type SubmissionExportFormat = (typeof SUBMISSION_EXPORT_FORMATS)[number];

export const SUBMISSION_EXPORT_MODES = ['all', 'unique'] as const;
export type SubmissionExportMode = (typeof SUBMISSION_EXPORT_MODES)[number];

export const SUBMISSION_EXPORT_TABLE_COLUMN_LIMIT = 6;

export type SubmissionExportRecord = SubmissionViewRecord & {
  createdAt: string;
  commercialEnquiryId?: string | null;
  clientId?: string | null;
  requirementId?: string | null;
  pipelineDealId?: string | null;
};

export type SubmissionExportTable = {
  headers: string[];
  columnIds: SubmissionColumnId[];
  rows: string[][];
};

const PDF_TABLE_MAX_CELL_LINES = 3;
const PDF_SECTION_MAX_VALUE_LINES = 8;
const PDF_AUTHOR = 'Ozer';

export function selectSubmissionsForExport<T extends SubmissionExportRecord>(
  submissions: T[],
  mode: SubmissionExportMode,
): T[] {
  if (mode === 'unique') return selectUniqueSubmissions(submissions);
  return submissions;
}

export function formatSubmissionExportReceivedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function submissionExportCellValue(
  submission: SubmissionExportRecord,
  column: SubmissionColumnId,
  field: WorkspaceFormField | undefined,
  submissionsOnly: boolean,
): string {
  if (column === 'received') {
    return formatSubmissionExportReceivedAt(submission.createdAt);
  }
  if (column === 'record') {
    return submissionRecordLabel(submission, submissionsOnly);
  }
  if (column === 'name' || column === 'email' || column === 'phone') {
    return submissionBuiltinValue(submission, column);
  }
  if (field) {
    return submissionFieldValue(submission, field);
  }
  return '';
}

export function resolveExportColumnIds(
  ids: readonly string[],
  fields: WorkspaceFormField[],
  fallback: readonly SubmissionColumnId[],
): SubmissionColumnId[] {
  const allowed = new Set(
    listSubmissionColumnOptions(fields).map((option) => option.id),
  );
  return (
    sanitizeSubmissionColumnIds(ids, allowed) ??
    sanitizeSubmissionColumnIds(fallback, allowed) ?? [
      'received',
      'name',
      'email',
    ]
  );
}

export function listAnsweredSubmissionColumnIds(
  fields: WorkspaceFormField[],
  submissions: SubmissionExportRecord[],
  submissionsOnly: boolean,
): SubmissionColumnId[] {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  return listSubmissionColumnOptions(fields)
    .filter((option) => {
      if (option.id === 'received') return submissions.length > 0;
      return submissions.some((submission) =>
        Boolean(
          submissionExportCellValue(
            submission,
            option.id,
            option.id.startsWith('field:')
              ? fieldByKey.get(option.id.slice(6))
              : undefined,
            submissionsOnly,
          ),
        ),
      );
    })
    .map((option) => option.id);
}

export function buildSubmissionExportTable(input: {
  fields: WorkspaceFormField[];
  submissions: SubmissionExportRecord[];
  columns: readonly SubmissionColumnId[];
  submissionsOnly: boolean;
}): SubmissionExportTable {
  const options = listSubmissionColumnOptions(input.fields);
  const optionById = new Map(options.map((option) => [option.id, option]));
  const fieldByKey = new Map(input.fields.map((field) => [field.key, field]));
  const columnIds = resolveExportColumnIds(
    input.columns,
    input.fields,
    options.map((option) => option.id),
  );

  return {
    columnIds,
    headers: columnIds.map((column) => optionById.get(column)?.label ?? column),
    rows: input.submissions.map((submission) =>
      columnIds.map((column) =>
        submissionExportCellValue(
          submission,
          column,
          column.startsWith('field:')
            ? fieldByKey.get(column.slice(6))
            : undefined,
          input.submissionsOnly,
        ),
      ),
    ),
  };
}

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeCsvFormula(value: string): string {
  return CSV_FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function submissionsExportToCsv(table: SubmissionExportTable): string {
  return `\uFEFF${buildCsvDocument(
    table.headers,
    table.rows.map((row) => row.map(neutralizeCsvFormula)),
  )}`;
}

export function slugifySubmissionExportName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'form'
  );
}

export function submissionsExportFilename(input: {
  formName: string;
  format: SubmissionExportFormat;
  mode: SubmissionExportMode;
  now?: Date;
}): string {
  const stamp = (input.now ?? new Date()).toISOString().slice(0, 10);
  const mode = input.mode === 'unique' ? 'unique' : 'all';
  return `${slugifySubmissionExportName(input.formName)}-submissions-${mode}-${stamp}.${input.format}`;
}

export function submissionsExportSubtitle(input: {
  mode: SubmissionExportMode;
  rowCount: number;
}): string {
  if (input.mode === 'unique') {
    return `Unique submissions (latest per email) · ${input.rowCount} row${input.rowCount === 1 ? '' : 's'}`;
  }
  return `All submissions · ${input.rowCount} row${input.rowCount === 1 ? '' : 's'}`;
}

function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const safe = sanitizePdfText(text).replace(/\s+/g, ' ').trim();
  if (!safe) return [''];

  const words = safe.split(' ');
  const lines: string[] = [];
  let current = '';

  const flush = (line: string) => {
    if (line) lines.push(line);
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    flush(current);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = '';
    for (const char of word) {
      const next = chunk + char;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        chunk = next;
      } else {
        flush(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }
  flush(current);

  if (lines.length <= maxLines) return lines.length ? lines : [''];

  const clipped = lines.slice(0, maxLines);
  let last = clipped[maxLines - 1] ?? '';
  while (last && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) {
    last = last.slice(0, -1);
  }
  clipped[maxLines - 1] = last ? `${last}...` : '...';
  return clipped;
}

const PDF = {
  ink: rgb(0.165, 0.09, 0.125),
  muted: rgb(0.42, 0.36, 0.39),
  line: rgb(0.88, 0.84, 0.8),
  cream: rgb(0.984, 0.965, 0.925),
  plum: rgb(0.208, 0.118, 0.157),
  stripe: rgb(0.996, 0.984, 0.965),
};

export async function buildSubmissionsExportPdf(input: {
  formName: string;
  mode: SubmissionExportMode;
  table: SubmissionExportTable;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const subtitle = submissionsExportSubtitle({
    mode: input.mode,
    rowCount: input.table.rows.length,
  });

  doc.setTitle(sanitizePdfText(`${input.formName} submissions`));
  doc.setAuthor(PDF_AUTHOR);

  const useTable =
    input.table.columnIds.length > 0 &&
    input.table.columnIds.length <= SUBMISSION_EXPORT_TABLE_COLUMN_LIMIT;

  if (useTable) {
    drawTablePdf(doc, {
      formName: input.formName,
      subtitle,
      table: input.table,
      regular,
      bold,
    });
  } else {
    drawSectionPdf(doc, {
      formName: input.formName,
      subtitle,
      table: input.table,
      regular,
      bold,
    });
  }

  return doc.save();
}

function drawHeader(
  page: ReturnType<PDFDocument['addPage']>,
  input: {
    formName: string;
    subtitle: string;
    width: number;
    height: number;
    margin: number;
    regular: PDFFont;
    bold: PDFFont;
  },
): number {
  const titleSize = 16;
  const y = input.height - input.margin - titleSize;
  page.drawText(sanitizePdfText(input.formName), {
    x: input.margin,
    y,
    size: titleSize,
    font: input.bold,
    color: PDF.plum,
  });
  page.drawText(sanitizePdfText(input.subtitle), {
    x: input.margin,
    y: y - 16,
    size: 9,
    font: input.regular,
    color: PDF.muted,
  });
  return y - 28;
}

function addFooter(
  page: ReturnType<PDFDocument['addPage']>,
  pageNumber: number,
  pageCount: number,
  width: number,
  margin: number,
  font: PDFFont,
) {
  const label = `Page ${pageNumber} of ${pageCount}`;
  const size = 8;
  page.drawText(label, {
    x: width - margin - font.widthOfTextAtSize(label, size),
    y: 22,
    size,
    font,
    color: PDF.muted,
  });
}

function drawTablePdf(
  doc: PDFDocument,
  input: {
    formName: string;
    subtitle: string;
    table: SubmissionExportTable;
    regular: PDFFont;
    bold: PDFFont;
  },
) {
  const pageSize: [number, number] = [842, 595];
  const margin = 36;
  const colCount = Math.max(input.table.headers.length, 1);
  const usableWidth = pageSize[0] - margin * 2;
  const colWidth = usableWidth / colCount;
  const fontSize = colCount > 4 ? 8 : 9;
  const lineHeight = fontSize + 3;
  const cellPad = 5;

  let page = doc.addPage(pageSize);
  let cursorY = drawHeader(page, {
    formName: input.formName,
    subtitle: input.subtitle,
    width: pageSize[0],
    height: pageSize[1],
    margin,
    regular: input.regular,
    bold: input.bold,
  });

  const headerLines = input.table.headers.map((header) =>
    wrapPdfText(header, input.bold, fontSize, colWidth - cellPad * 2, 2),
  );
  const headerHeight =
    Math.max(...headerLines.map((lines) => lines.length), 1) * lineHeight +
    cellPad * 2;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: margin,
      y: cursorY - headerHeight,
      width: usableWidth,
      height: headerHeight,
      color: PDF.plum,
    });
    input.table.headers.forEach((header, index) => {
      const lines = headerLines[index] ?? [header];
      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: margin + index * colWidth + cellPad,
          y: cursorY - cellPad - fontSize - lineIndex * lineHeight,
          size: fontSize,
          font: input.bold,
          color: PDF.cream,
        });
      });
    });
    cursorY -= headerHeight;
  };

  drawTableHeader();

  const rows =
    input.table.rows.length > 0
      ? input.table.rows
      : [input.table.headers.map(() => '—')];

  rows.forEach((row, rowIndex) => {
    const wrapped = row.map((cell) =>
      wrapPdfText(
        cell || '—',
        input.regular,
        fontSize,
        colWidth - cellPad * 2,
        PDF_TABLE_MAX_CELL_LINES,
      ),
    );
    const rowHeight =
      Math.max(...wrapped.map((lines) => lines.length), 1) * lineHeight +
      cellPad * 2;

    if (cursorY - rowHeight < margin + 18) {
      page = doc.addPage(pageSize);
      cursorY = drawHeader(page, {
        formName: input.formName,
        subtitle: input.subtitle,
        width: pageSize[0],
        height: pageSize[1],
        margin,
        regular: input.regular,
        bold: input.bold,
      });
      drawTableHeader();
    }

    if (rowIndex % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: cursorY - rowHeight,
        width: usableWidth,
        height: rowHeight,
        color: PDF.stripe,
      });
    }

    wrapped.forEach((lines, colIndex) => {
      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: margin + colIndex * colWidth + cellPad,
          y: cursorY - cellPad - fontSize - lineIndex * lineHeight,
          size: fontSize,
          font: input.regular,
          color: PDF.ink,
        });
      });
    });

    page.drawLine({
      start: { x: margin, y: cursorY - rowHeight },
      end: { x: margin + usableWidth, y: cursorY - rowHeight },
      thickness: 0.4,
      color: PDF.line,
    });
    cursorY -= rowHeight;
  });

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    addFooter(
      item,
      index + 1,
      pages.length,
      pageSize[0],
      margin,
      input.regular,
    );
  });
}

function drawSectionPdf(
  doc: PDFDocument,
  input: {
    formName: string;
    subtitle: string;
    table: SubmissionExportTable;
    regular: PDFFont;
    bold: PDFFont;
  },
) {
  const pageSize: [number, number] = [595, 842];
  const margin = 40;
  const labelWidth = 130;
  const fontSize = 9;
  const lineHeight = 12;
  const usableWidth = pageSize[0] - margin * 2;

  let page = doc.addPage(pageSize);
  let cursorY = drawHeader(page, {
    formName: input.formName,
    subtitle: input.subtitle,
    width: pageSize[0],
    height: pageSize[1],
    margin,
    regular: input.regular,
    bold: input.bold,
  });

  const ensureSpace = (needed: number) => {
    if (cursorY - needed >= margin + 18) return;
    page = doc.addPage(pageSize);
    cursorY = drawHeader(page, {
      formName: input.formName,
      subtitle: input.subtitle,
      width: pageSize[0],
      height: pageSize[1],
      margin,
      regular: input.regular,
      bold: input.bold,
    });
  };

  if (input.table.rows.length === 0) {
    ensureSpace(20);
    page.drawText('No submissions to export.', {
      x: margin,
      y: cursorY - 12,
      size: 10,
      font: input.regular,
      color: PDF.muted,
    });
  }

  input.table.rows.forEach((row, rowIndex) => {
    const blocks = input.table.headers.map((header, index) => {
      const valueLines = wrapPdfText(
        row[index] || '—',
        input.regular,
        fontSize,
        usableWidth - labelWidth - 8,
        PDF_SECTION_MAX_VALUE_LINES,
      );
      return { header, valueLines };
    });
    const blockHeight =
      22 +
      blocks.reduce(
        (sum, block) => sum + block.valueLines.length * lineHeight + 4,
        0,
      );

    ensureSpace(blockHeight + 10);

    page.drawText(`Submission ${rowIndex + 1}`, {
      x: margin,
      y: cursorY - 12,
      size: 11,
      font: input.bold,
      color: PDF.plum,
    });
    cursorY -= 20;

    for (const block of blocks) {
      const height = block.valueLines.length * lineHeight;
      ensureSpace(height + 6);
      page.drawText(sanitizePdfText(block.header), {
        x: margin,
        y: cursorY - fontSize,
        size: fontSize,
        font: input.bold,
        color: PDF.muted,
      });
      block.valueLines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: margin + labelWidth,
          y: cursorY - fontSize - lineIndex * lineHeight,
          size: fontSize,
          font: input.regular,
          color: PDF.ink,
        });
      });
      cursorY -= height + 4;
    }

    cursorY -= 8;
    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: margin + usableWidth, y: cursorY },
      thickness: 0.6,
      color: PDF.line,
    });
    cursorY -= 12;
  });

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    addFooter(
      item,
      index + 1,
      pages.length,
      pageSize[0],
      margin,
      input.regular,
    );
  });
}
