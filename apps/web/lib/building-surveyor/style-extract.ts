import { inflateRawSync, inflateSync } from 'node:zlib';

const MAX_EXTRACT_CHARS = 40_000;

export const SURVEY_STYLE_ACCEPT =
  '.pdf,.docx,.html,.htm,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain';

export function isSurveyStyleMime(
  mimeType: string | null | undefined,
  filename: string,
): boolean {
  const mime = (mimeType ?? '').toLowerCase();
  const name = filename.toLowerCase();
  return (
    mime.includes('pdf') ||
    mime.includes('wordprocessingml') ||
    mime.includes('html') ||
    mime === 'text/plain' ||
    name.endsWith('.pdf') ||
    name.endsWith('.docx') ||
    name.endsWith('.html') ||
    name.endsWith('.htm') ||
    name.endsWith('.txt')
  );
}

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

  return collapseWhitespace(text).slice(0, MAX_EXTRACT_CHARS);
}

export function heuristicStyleNotes(extractedText: string): string {
  const sample = collapseWhitespace(extractedText).slice(0, 1_200);
  if (!sample) {
    return 'No extractable text. Add style notes by hand, or upload an HTML / DOCX export.';
  }

  const sentences = sample
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 40)
    .slice(0, 3);

  const traits: string[] = [
    'British English. Factual, cautious, and specific about condition.',
    'Use short professional paragraphs. Do not invent defects.',
  ];
  if (/\bcondition rating\b/i.test(sample)) {
    traits.push('Refer to condition ratings where the source reports do.');
  }
  if (/\brecommend(s|ed|ation)?\b/i.test(sample)) {
    traits.push(
      'Close findings with a clear recommendation when evidence exists.',
    );
  }
  if (sentences.length > 0) {
    traits.push(
      `Example phrasing:\n${sentences.map((item) => `“${item}”`).join('\n')}`,
    );
  }

  return traits.join('\n');
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
}

function collapseWhitespace(value: string): string {
  return value
    .split(String.fromCharCode(0))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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
