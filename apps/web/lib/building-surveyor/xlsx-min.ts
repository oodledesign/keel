/**
 * Minimal OOXML reader for GoReport xlsx. Node-only (zlib).
 * Import from server services or unit tests — not client components.
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib';

type ZipEntry = {
  name: string;
  data: Buffer;
};

function readU32(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

function readU16(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

function crc32(data: Buffer): number {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return ~crc >>> 0;
}

export function unzipBuffer(input: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= input.length) {
    const sig = readU32(input, offset);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    if (sig !== 0x04034b50) {
      throw new Error('Not a zip archive');
    }

    const method = readU16(input, offset + 8);
    const compSize = readU32(input, offset + 18);
    const nameLen = readU16(input, offset + 26);
    const extraLen = readU16(input, offset + 28);
    const name = input
      .subarray(offset + 30, offset + 30 + nameLen)
      .toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const compressed = input.subarray(dataStart, dataStart + compSize);
    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(compressed);
    } else if (method === 8) {
      data = inflateRawSync(compressed);
    } else {
      throw new Error(`Unsupported zip method ${method}`);
    }
    entries.push({ name, data });
    offset = dataStart + compSize;
  }

  return entries;
}

export function zipEntries(
  files: Array<{ name: string; data: Buffer | string }>,
): Buffer {
  const chunks: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const data =
      typeof file.data === 'string'
        ? Buffer.from(file.data, 'utf8')
        : file.data;
    const name = Buffer.from(file.name, 'utf8');
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);

  return Buffer.concat([...chunks, centralBuf, eocd]);
}

const SS_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function xmlEscape(value: string): string {
  return value
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

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  for (const match of xml.matchAll(siRe)) {
    const texts = [
      ...(match[1] ?? '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g),
    ].map((item) => decodeXml(item[1] ?? ''));
    out.push(texts.join(''));
  }
  return out;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colRow(ref: string): { col: number; row: number } {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return { col: 0, row: 0 };
  let col = 0;
  for (const ch of match[1] ?? '') {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { col, row: Number(match[2]) };
}

export type XlsxCellRow = {
  a: string;
  b: string;
  c: string;
};

export function readFirstSheetRows(buffer: Buffer): XlsxCellRow[] {
  const entries = unzipBuffer(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
  const ssXml = byName.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  const strings = ssXml ? parseSharedStrings(ssXml) : [];
  const sheet =
    byName.get('xl/worksheets/sheet1.xml')?.toString('utf8') ??
    [...byName.keys()]
      .filter((name) => name.startsWith('xl/worksheets/sheet'))
      .sort()
      .map((name) => byName.get(name)?.toString('utf8') ?? '')[0] ??
    '';

  const rows = new Map<number, XlsxCellRow>();
  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  for (const match of sheet.matchAll(cellRe)) {
    const attrs = match[1] ?? '';
    const inner = match[2] ?? '';
    const ref = /r="([^"]+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const { col, row } = colRow(ref);
    if (col < 1 || col > 3 || !row) continue;
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    let value = '';
    if (type === 'inlineStr') {
      value = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((item) => decodeXml(item[1] ?? ''))
        .join('');
    } else {
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '';
      value = type === 's' ? (strings[Number(raw)] ?? '') : decodeXml(raw);
    }
    const current = rows.get(row) ?? { a: '', b: '', c: '' };
    if (col === 1) current.a = value;
    if (col === 2) current.b = value;
    if (col === 3) current.c = value;
    rows.set(row, current);
  }

  return [...rows.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, row]) => row);
}

export function buildMinimalXlsx(
  rows: Array<[string, string?, string?]>,
): Buffer {
  const unique: string[] = [];
  const index = new Map<string, number>();
  const intern = (value: string) => {
    const existing = index.get(value);
    if (existing !== undefined) return existing;
    const next = unique.length;
    unique.push(value);
    index.set(value, next);
    return next;
  };

  const cellXml = rows
    .map((cols, rowIndex) => {
      const r = rowIndex + 1;
      const cells = cols
        .map((value, colIndex) => {
          if (value === undefined) return '';
          const ref = `${colLetter(colIndex + 1)}${r}`;
          const si = intern(value);
          return `<c r="${ref}" t="s"><v>${si}</v></c>`;
        })
        .join('');
      return `<row r="${r}">${cells}</row>`;
    })
    .join('');

  const shared = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${SS_NS}" count="${unique.length}" uniqueCount="${unique.length}">${unique
    .map((value) => `<si><t>${xmlEscape(value)}</t></si>`)
    .join('')}</sst>`;

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${SS_NS}"><sheetData>${cellXml}</sheetData></worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${SS_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Predefined Responses" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`;

  return zipEntries([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
    { name: 'xl/sharedStrings.xml', data: shared },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
  ]);
}
