import 'server-only';

const APPROX_WORDS_PER_TOKEN = 0.75;

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Split Markdown-ish text into embedding-sized chunks with sentence overlap. */
export function splitIntoChunks(
  text: string,
  maxWords = 600,
  overlapSentences = 2,
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    const trimmed = buffer.trim();
    if (countWords(trimmed) >= 20) {
      chunks.push(trimmed);
    }
    buffer = '';
  };

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (countWords(candidate) <= maxWords) {
      buffer = candidate;
      continue;
    }

    if (buffer) flush();

    if (countWords(paragraph) <= maxWords) {
      buffer = paragraph;
      continue;
    }

    const sentences = splitSentences(paragraph);
    let current = '';
    let overlap: string[] = [];

    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (countWords(next) <= maxWords) {
        current = next;
        continue;
      }

      if (current && countWords(current) >= 20) {
        chunks.push(current.trim());
      }

      overlap = splitSentences(current).slice(-overlapSentences);
      current = [...overlap, sentence].join(' ').trim();
    }

    if (current && countWords(current) >= 20) {
      chunks.push(current.trim());
    }
    buffer = '';
  }

  if (buffer) flush();

  return chunks.length > 0
    ? chunks
    : countWords(normalized) >= 20
      ? [normalized]
      : [];
}

export function estimateTokens(text: string): number {
  return Math.ceil(countWords(text) / APPROX_WORDS_PER_TOKEN);
}
