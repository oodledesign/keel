import 'server-only';

import { inflateRawSync, inflateSync } from 'node:zlib';

import {
  clipExtractedStyleText,
  stripHtml,
} from '~/lib/building-surveyor/style-extract';

export function extractStyleDocumentText(input: {
  filename: string;
  mimeType?: string | null;
  buffer: Buffer;
}): string {
  const name = input.filename.toLowerCase();
  const mime = (input.mimeType ?? '').toLowerCase();

  let text = '';
  if (
    mime.includes('html') ||
    name.endsWith('.html') ||
    name.endsWith('.htm')
  ) {
    text = stripHtml(input.buffer.toString('utf8'));
  } else if (mime === 'text/plain' || name.endsWith('.txt')) {
    text = input.buffer.toString('utf8');
  } else if (mime.includes('wordprocessingml') || name.endsWith('.docx')) {
    text = extractDocxPlainText(input.buffer);
  } else if (mime.includes('pdf') || name.endsWith('.pdf')) {
    text = extractPdfPlainText(input.buffer);
  } else {
    text = stripHtml(input.buffer.toString('utf8'));
  }

  return clipExtractedStyleText(text);
}

function extractDocxPlainText(buffer: Buffer): string {
  const xml = readZipEntry(buffer, 'word/document.xml');
  if (!xml) return '';
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\b[^/]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t[^>]*>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function readZipEntry(buffer: Buffer, entryName: string): string | null {
  let offset = 0;
  while (offset + 30 < buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + filenameLength;
    if (nameEnd > buffer.length) break;

    const name = buffer.subarray(nameStart, nameEnd).toString('utf8');
    const dataStart = nameEnd + extraLength;
    if ((flags & 0x08) !== 0 || compressedSize === 0xffffffff) {
      offset = dataStart;
      continue;
    }

    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) break;

    if (name === entryName) {
      const payload = buffer.subarray(dataStart, dataEnd);
      try {
        if (method === 0) return payload.toString('utf8');
        if (method === 8) {
          try {
            return inflateRawSync(payload).toString('utf8');
          } catch {
            return inflateSync(payload).toString('utf8');
          }
        }
      } catch {
        return null;
      }
    }

    offset = dataEnd;
  }

  return null;
}

function extractPdfPlainText(buffer: Buffer): string {
  const source = buffer.toString('latin1');
  const chunks: string[] = [];
  const literal = /\(((?:\\.|[^\\)]){3,})\)/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(source))) {
    const decoded = decodePdfLiteral(match[1] ?? '');
    if (decoded.length >= 3 && /[A-Za-z]/.test(decoded)) {
      chunks.push(decoded);
    }
  }
  return chunks.join(' ');
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_, oct: string) =>
      String.fromCharCode(parseInt(oct, 8)),
    );
}
