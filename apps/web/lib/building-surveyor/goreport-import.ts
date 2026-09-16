import {
  type GoreportMappedField,
  isGoreportChecksumRow,
  isGoreportColumnHeader,
  isGoreportFieldHeader,
  mapGoreportPath,
} from './goreport-rics-map';
import { type XlsxCellRow, readFirstSheetRows } from './xlsx-min';

export type GoreportImportedPhrase = GoreportMappedField & {
  title: string;
  body: string;
  nestedPath: string;
};

export type GoreportImportResult = {
  phrases: GoreportImportedPhrase[];
  fields: GoreportMappedField[];
  fieldCount: number;
  skippedChecksum: boolean;
};

export function parseGoreportRows(rows: XlsxCellRow[]): GoreportImportResult {
  const phrases: GoreportImportedPhrase[] = [];
  const fields: GoreportMappedField[] = [];
  let current: GoreportMappedField | null = null;
  let skippedChecksum = false;

  for (const row of rows) {
    const a = row.a?.trim() ?? '';
    const b = row.b?.trim() ?? '';
    const c = row.c?.trim() ?? '';

    if (!a && !b) continue;
    if (isGoreportChecksumRow(a)) {
      skippedChecksum = true;
      continue;
    }

    if (isGoreportFieldHeader(a) && !b) {
      current = mapGoreportPath(a);
      fields.push(current);
      continue;
    }

    if (isGoreportColumnHeader(a) && b.toLowerCase() === 'text') {
      continue;
    }

    if (!current || !a || !b) continue;

    phrases.push({
      ...current,
      title: a,
      body: b,
      nestedPath: c,
    });
  }

  return { phrases, fields, fieldCount: fields.length, skippedChecksum };
}

export function parseGoreportXlsx(buffer: Buffer): GoreportImportResult {
  return parseGoreportRows(readFirstSheetRows(buffer));
}
