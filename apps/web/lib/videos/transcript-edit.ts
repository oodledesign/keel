import type { VideoTranscriptWord } from './edit-timeline';

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function core(token: string) {
  return token.trim().replace(EDGE_PUNCTUATION, '');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function leadingWhitespace(text: string) {
  return /^\s*/.exec(text)?.[0] ?? '';
}

/**
 * Replace words[fromIndex..toIndex] with `text`, keeping timings. Equal token
 * counts keep each word's own timing; otherwise the new tokens share the
 * selection's span evenly. The plain text is patched in place so punctuation
 * elsewhere survives; if the phrase can't be located it is rebuilt from words.
 */
export function replaceTranscriptWords(input: {
  words: VideoTranscriptWord[];
  plainText: string;
  fromIndex: number;
  toIndex: number;
  text: string;
}): { words: VideoTranscriptWord[]; plainText: string } {
  const { words, fromIndex, toIndex } = input;
  const tokens = input.text.trim().split(/\s+/).filter(Boolean);
  const selected = words.slice(fromIndex, toIndex + 1);
  if (tokens.length === 0 || selected.length === 0) {
    return { words, plainText: input.plainText };
  }

  const lead = leadingWhitespace(selected[0]!.text);
  let replacement: VideoTranscriptWord[];
  if (tokens.length === selected.length) {
    replacement = selected.map((word, i) => ({
      ...word,
      text: leadingWhitespace(word.text) + tokens[i]!,
    }));
  } else {
    const startMs = selected[0]!.startMs;
    const span = Math.max(0, selected[selected.length - 1]!.endMs - startMs);
    replacement = tokens.map((token, i) => ({
      text: lead + token,
      startMs: Math.round(startMs + (span * i) / tokens.length),
      endMs: Math.round(startMs + (span * (i + 1)) / tokens.length),
      confidence: null,
    }));
  }

  const nextWords = [
    ...words.slice(0, fromIndex),
    ...replacement,
    ...words.slice(toIndex + 1),
  ];

  return {
    words: nextWords,
    plainText:
      patchPlainText(input.plainText, words, fromIndex, selected, tokens) ??
      nextWords.map((w) => w.text.trim()).join(' '),
  };
}

function patchPlainText(
  plainText: string,
  words: VideoTranscriptWord[],
  fromIndex: number,
  selected: VideoTranscriptWord[],
  tokens: string[],
): string | null {
  const oldCores = selected.map((w) => core(w.text)).filter(Boolean);
  if (!plainText.trim() || oldCores.length === 0) return null;

  // Which occurrence of this phrase the selection is, counting from the start.
  const wanted = oldCores.map((c) => c.toLowerCase());
  const allCores = words.map((w) => core(w.text).toLowerCase());
  let occurrence = 0;
  for (let i = 0; i < fromIndex; i++) {
    if (wanted.every((c, k) => allCores[i + k] === c)) occurrence++;
  }

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${oldCores
      .map((c) => `(${escapeRegExp(c)})`)
      .join('([^\\p{L}\\p{N}]+)')}(?![\\p{L}\\p{N}])`,
    'giu',
  );

  let match: RegExpExecArray | null = null;
  for (let seen = 0; seen <= occurrence; seen++) {
    match = pattern.exec(plainText);
    if (!match) return null;
  }
  if (!match) return null;

  let span: string;
  if (tokens.length === oldCores.length) {
    const separators = match.slice(1).filter((_, i) => i % 2 === 1);
    span = tokens
      .map((t, i) => (core(t) || t) + (separators[i] ?? ''))
      .join('');
  } else {
    span = tokens.join(' ');
  }

  return (
    plainText.slice(0, match.index) +
    span +
    plainText.slice(match.index + match[0].length)
  );
}
