/**
 * Deterministic hygiene for Assistant dictation before it is stored as a
 * note, meeting transcript, or task.
 *
 * On-device speech often restarts a hypothesis and appends it again, sometimes
 * with no space, then cuts off mid-word. This collapses those adjacent copies.
 * It does not rewrite wording. Meeting summary prompts stay as they are.
 */

const MIN_REPEAT_CHARS = 40;
const MIN_FRAGMENT_CHARS = 8;
const SIGNATURE_CHARS = 24;
const MAX_PASSES = 5;

export function cleanDictationTranscript(input: string): string {
  if (!input || input.length < MIN_REPEAT_CHARS + MIN_FRAGMENT_CHARS) {
    return input;
  }

  let text = input;
  let changed = false;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = collapseOneRepeat(text);
    if (next === text) break;
    text = next;
    changed = true;
  }

  const trimmed = trimTrailingRestart(text);
  if (trimmed !== text) {
    text = trimmed;
    changed = true;
  }

  return changed ? text : input;
}

export function cleanStoredSpeakerSegments(value: unknown): {
  segments: unknown[];
  changed: boolean;
} | null {
  if (!Array.isArray(value)) return null;

  let changed = false;
  const segments = value.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const row = item as Record<string, unknown>;
    if (typeof row.text !== 'string') return item;
    const text = cleanDictationTranscript(row.text);
    if (text === row.text) return item;
    changed = true;
    return { ...row, text };
  });

  return { segments, changed };
}

function collapseOneRepeat(text: string): string {
  const match = findAdjacentRepeat(text);
  if (!match) return text;

  const next = text.slice(0, match.removeFrom) + text.slice(match.end);
  return softJoinAt(next, match.removeFrom);
}

function findAdjacentRepeat(text: string): {
  removeFrom: number;
  end: number;
} | null {
  const length = text.length;
  if (length < MIN_REPEAT_CHARS * 2) return null;

  const lower = text.toLowerCase();
  let best: { removeFrom: number; end: number; span: number } | null = null;
  const maxStarts = length > 20_000 ? 800 : 4_000;
  let seen = 0;

  for (let start = 0; start <= length - MIN_REPEAT_CHARS * 2; start++) {
    if (!isSearchStart(text, start)) continue;
    seen += 1;
    if (seen > maxStarts) break;

    const signatureEnd = Math.min(length, start + SIGNATURE_CHARS);
    if (signatureEnd - start < 16) continue;
    const signature = lower.slice(start, signatureEnd);
    if (signature.trim().length < 16) continue;

    let from = start + MIN_REPEAT_CHARS;
    let hits = 0;
    while (from < length && hits < 6) {
      const mid = lower.indexOf(signature, from);
      if (mid === -1) break;
      hits += 1;
      const repeat = repeatSpan(lower, start, mid);
      if (repeat && (!best || repeat.span > best.span)) {
        best = repeat;
      }
      from = mid + 1;
    }
  }

  return best;
}

/**
 * `mid` is where the second copy's opening matches. A few spaces or newlines
 * between the copies are not part of either copy.
 */
function repeatSpan(
  lower: string,
  start: number,
  mid: number,
): { removeFrom: number; end: number; span: number } | null {
  let removeFrom = mid;
  let skipped = 0;
  while (
    removeFrom > start &&
    skipped < 3 &&
    /\s/.test(lower[removeFrom - 1] ?? '')
  ) {
    removeFrom -= 1;
    skipped += 1;
  }

  const span = removeFrom - start;
  if (span < MIN_REPEAT_CHARS) return null;
  const end = mid + span;
  if (end > lower.length) return null;
  if (!slicesEqual(lower, start, mid, span)) return null;
  return { removeFrom, end, span };
}

function isSearchStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const previous = text[index - 1] ?? '';
  const current = text[index] ?? '';
  if (/[A-Za-z]/.test(current) && !/[A-Za-z]/.test(previous)) return true;
  return /[a-z]/.test(previous) && /[A-Z]/.test(current);
}

function slicesEqual(
  lower: string,
  left: number,
  right: number,
  span: number,
): boolean {
  for (let offset = 0; offset < span; offset++) {
    if (lower[left + offset] !== lower[right + offset]) return false;
  }
  return true;
}

/**
 * Insert a space where a removed copy had been glued to the text we kept.
 * Single-letter camelCase such as "iPhone" is never a repeat boundary here.
 */
function softJoinAt(text: string, index: number): string {
  if (index <= 0 || index >= text.length) return text;
  const left = text[index - 1] ?? '';
  const right = text[index] ?? '';
  if (/\s/.test(left) || /\s/.test(right)) return text;

  // Uppercase on the right is a new word glued on ("nowThe"). Lowercase
  // on both sides is usually one word split by an overlap ("Frid" + "ay").
  const letterBoundary = /[a-z]/.test(left) && /[A-Z]/.test(right);
  const sentenceBoundary = /[.!?]/.test(left) && /[A-Za-z]/.test(right);
  if (!letterBoundary && !sentenceBoundary) return text;

  return `${text.slice(0, index)} ${text.slice(index)}`;
}

function trimTrailingRestart(text: string): string {
  const lower = text.toLowerCase();
  const length = lower.length;
  if (length < MIN_REPEAT_CHARS + MIN_FRAGMENT_CHARS) return text;

  const searchWords = restartSearchWords(lower);
  if (searchWords.length === 0) return text;

  let bestCut: number | null = null;

  for (const word of searchWords) {
    let from = MIN_REPEAT_CHARS;
    while (from < length) {
      const found = lower.indexOf(word, from);
      if (found === -1) break;

      const previous = text[found - 1] ?? '';
      const glued = !/\s/.test(previous);
      if (startsAtWord(lower, found, word)) {
        const tail = lower.slice(found).trim();
        const head = lower.slice(0, found).trim();
        if (
          tail.length >= MIN_FRAGMENT_CHARS &&
          head.length >= MIN_REPEAT_CHARS &&
          tail.length < head.length &&
          isRestartFragment(tail, head, glued)
        ) {
          bestCut = found;
        }
      }

      from = found + word.length;
    }
  }

  if (bestCut == null) return text;
  return text.slice(0, bestCut).trimEnd();
}

function isRestartFragment(
  tail: string,
  head: string,
  glued: boolean,
): boolean {
  const tailWords = tail.split(/\s+/).filter(Boolean);
  if (tailWords.length < 2) return false;

  return headOpenings(head).some((opening) =>
    fragmentMatchesOpening(tailWords, opening, glued),
  );
}

function headOpenings(head: string): string[] {
  const openings = [head];
  const labelled = head.match(/^[^:\n]{1,40}:\s*([\s\S]+)$/);
  const body = labelled?.[1]?.trim();
  if (body) openings.push(body);
  return openings;
}

function fragmentMatchesOpening(
  tailWords: string[],
  opening: string,
  glued: boolean,
): boolean {
  const openingWords = opening.split(/\s+/).filter(Boolean);
  if (tailWords.length > openingWords.length) return false;

  for (let index = 0; index < tailWords.length - 1; index++) {
    if (
      normalizeWord(tailWords[index] ?? '') !==
      normalizeWord(openingWords[index] ?? '')
    ) {
      return false;
    }
  }

  const lastTail = normalizeWord(tailWords[tailWords.length - 1] ?? '');
  const lastOpening = normalizeWord(openingWords[tailWords.length - 1] ?? '');
  if (!lastTail || !lastOpening) return false;

  const incomplete =
    lastOpening.startsWith(lastTail) &&
    lastTail.length >= 2 &&
    lastTail.length < lastOpening.length;
  if (incomplete) return true;
  if (lastTail !== lastOpening || !glued) return false;

  const tail = tailWords.join(' ');
  return tailWords.length >= 2 && tail.length >= MIN_FRAGMENT_CHARS;
}

function restartSearchWords(lower: string): string[] {
  const words = [firstWord(lower)];
  const labelled = lower.match(/^[^:\n]{1,40}:\s*([\s\S]+)$/);
  const body = labelled?.[1] ? firstWord(labelled[1]) : '';
  if (body) words.push(body);
  return [...new Set(words.filter((word) => word.length >= 2))];
}

function startsAtWord(lower: string, index: number, word: string): boolean {
  if (lower.slice(index, index + word.length) !== word) return false;
  const next = lower[index + word.length] ?? '';
  return next === '' || !/[a-z0-9]/i.test(next);
}

function firstWord(lower: string): string {
  const match = lower.match(/[a-z0-9]+/i);
  return match?.[0] ?? '';
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
}
