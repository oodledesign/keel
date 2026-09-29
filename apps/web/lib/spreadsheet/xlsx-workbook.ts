/**
 * Minimal multi-sheet OOXML (xlsx) writer. Node-only (zlib via zipEntries).
 * Header row is bold, frozen and filterable; money/date columns get Excel
 * number formats so they sort and total properly.
 */
import { zipEntries } from '~/lib/building-surveyor/xlsx-min';

export type XlsxColumnFormat =
  | 'text'
  | 'number'
  | 'money'
  | 'date'
  | 'datetime';

export type XlsxColumn = {
  header: string;
  format?: XlsxColumnFormat;
  /** Approximate width in characters. */
  width?: number;
};

export type XlsxCell = string | number | boolean | null | undefined;

export type XlsxSheet = {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
};

const SS_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const STYLE_DEFAULT = 0;
const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const STYLE_MONEY = 3;
const STYLE_DATETIME = 4;
const STYLE_WRAP = 5;

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

const INVALID_XML_CHARS =
  // eslint-disable-next-line no-control-regex -- strip chars XML 1.0 forbids
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function xmlEscape(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Excel serial date for an ISO date / timestamp, or null if unparseable. */
export function toExcelSerial(value: string, withTime: boolean): number | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const ms = dateOnly ? Date.parse(`${value}T00:00:00Z`) : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const days = (ms - EXCEL_EPOCH_MS) / MS_PER_DAY;
  return withTime ? days : Math.floor(days);
}

function sheetName(name: string, used: Set<string>): string {
  const base =
    name
      .replace(/[[\]:*?/\\]/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet';
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${i}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    i += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function textCell(ref: string, value: string, style: number): string {
  const text = xmlEscape(value);
  const space = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : '';
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t${space}>${text}</t></is></c>`;
}

function cellXml(ref: string, value: XlsxCell, format: XlsxColumnFormat) {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'boolean') {
    return textCell(ref, value ? 'Yes' : 'No', STYLE_DEFAULT);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const style = format === 'money' ? STYLE_MONEY : STYLE_DEFAULT;
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }

  if (format === 'date' || format === 'datetime') {
    const serial = toExcelSerial(value, format === 'datetime');
    if (serial !== null) {
      const style = format === 'datetime' ? STYLE_DATETIME : STYLE_DATE;
      return `<c r="${ref}" s="${style}"><v>${serial}</v></c>`;
    }
  }

  return textCell(
    ref,
    value,
    value.includes('\n') ? STYLE_WRAP : STYLE_DEFAULT,
  );
}

function worksheetXml(sheet: XlsxSheet): string {
  const colCount = Math.max(sheet.columns.length, 1);
  const lastCol = colLetter(colCount);
  const lastRow = sheet.rows.length + 1;

  const cols = sheet.columns
    .map((column, index) => {
      const width =
        column.width ?? Math.min(Math.max(column.header.length + 2, 10), 40);
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');

  const header = `<row r="1">${sheet.columns
    .map((column, index) =>
      textCell(`${colLetter(index + 1)}1`, column.header, STYLE_HEADER),
    )
    .join('')}</row>`;

  const body = sheet.rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = sheet.columns
        .map((column, colIndex) =>
          cellXml(
            `${colLetter(colIndex + 1)}${r}`,
            row[colIndex],
            column.format ?? 'text',
          ),
        )
        .join('');
      return `<row r="${r}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${SS_NS}" xmlns:r="${REL_NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${
    cols ? `<cols>${cols}</cols>` : ''
  }<sheetData>${header}${body}</sheetData><autoFilter ref="A1:${lastCol}${lastRow}"/></worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${SS_NS}"><numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;£&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function buildXlsxWorkbook(sheets: XlsxSheet[]): Buffer {
  if (sheets.length === 0) throw new Error('Workbook needs at least one sheet');

  const used = new Set<string>();
  const names = sheets.map((sheet) => sheetName(sheet.name, used));

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${SS_NS}" xmlns:r="${REL_NS}"><sheets>${names
    .map(
      (name, index) =>
        `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('')}</sheets><definedNames>${names
    .map((name, index) => {
      const sheet = sheets[index]!;
      const lastCol = colLetter(Math.max(sheet.columns.length, 1));
      const quoted = `'${name.replace(/'/g, "''")}'`;
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">${xmlEscape(
        `${quoted}!$A$1:$${lastCol}$${sheet.rows.length + 1}`,
      )}</definedName>`;
    })
    .join('')}</definedNames></workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join(
      '',
    )}<Relationship Id="rId${names.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')}</Types>`;

  return zipEntries([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
    { name: 'xl/styles.xml', data: STYLES_XML },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: worksheetXml(sheet),
    })),
  ]);
}
