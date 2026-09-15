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

export function stripHtml(html: string): string {
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

export function collapseWhitespace(value: string): string {
  return value
    .split(String.fromCharCode(0))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function clipExtractedStyleText(text: string): string {
  return collapseWhitespace(text).slice(0, MAX_EXTRACT_CHARS);
}
