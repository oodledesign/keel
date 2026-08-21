import 'server-only';

import { docsUrl } from '~/lib/docs-url';

import corpusJson from './docs-corpus.generated.json';

export type DocsCorpusChunk = {
  id: string;
  path: string;
  title: string;
  text: string;
};

export type DocsChatSource = {
  title: string;
  path: string;
  url: string;
};

export type RetrievedDocsChunk = DocsCorpusChunk & {
  score: number;
  url: string;
};

type CorpusFile = {
  generatedAt?: string;
  chunkCount?: number;
  chunks: DocsCorpusChunk[];
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'i',
  'you',
  'we',
  'they',
  'it',
  'this',
  'that',
  'with',
  'from',
  'as',
  'by',
  'about',
  'into',
  'how',
  'what',
  'when',
  'where',
  'why',
  'which',
  'who',
  'my',
  'our',
  'your',
  'me',
  'us',
]);

function loadChunks(): DocsCorpusChunk[] {
  const data = corpusJson as CorpusFile;
  return Array.isArray(data.chunks) ? data.chunks : [];
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .split(/[\s/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreChunk(queryTokens: string[], chunk: DocsCorpusChunk): number {
  if (queryTokens.length === 0) return 0;

  const haystack = `${chunk.title} ${chunk.path} ${chunk.text}`.toLowerCase();
  const titleLower = chunk.title.toLowerCase();
  const pathLower = chunk.path.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (titleLower.includes(token)) score += 4;
    if (pathLower.includes(token)) score += 3;
    if (haystack.includes(token)) score += 1;

    // Light boost for whole-word-ish matches in body
    const wordRe = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
    if (wordRe.test(chunk.text)) score += 1;
  }

  return score;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rank MDX corpus chunks for a free-text support question.
 */
export function retrieveDocsChunks(
  query: string,
  limit = 5,
): RetrievedDocsChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = loadChunks()
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(queryTokens, chunk),
      url: docsUrl(chunk.path),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  // Prefer unique paths first, then fill remaining slots
  const picked: RetrievedDocsChunk[] = [];
  const seenPaths = new Set<string>();

  for (const chunk of scored) {
    if (picked.length >= limit) break;
    if (seenPaths.has(chunk.path)) continue;
    seenPaths.add(chunk.path);
    picked.push(chunk);
  }

  for (const chunk of scored) {
    if (picked.length >= limit) break;
    if (picked.some((item) => item.id === chunk.id)) continue;
    picked.push(chunk);
  }

  return picked;
}

export function sourcesFromChunks(
  chunks: RetrievedDocsChunk[],
): DocsChatSource[] {
  const byPath = new Map<string, DocsChatSource>();
  for (const chunk of chunks) {
    if (byPath.has(chunk.path)) continue;
    byPath.set(chunk.path, {
      title: chunk.title,
      path: chunk.path,
      url: chunk.url,
    });
  }
  return [...byPath.values()];
}
