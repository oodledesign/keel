import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** See COPY_STYLE.md. */
const MARKETING_DIR = path.dirname(fileURLToPath(import.meta.url));

const BANNED: Array<{ label: string; pattern: RegExp }> = [
  { label: 'actually', pattern: /\bactually\b/i },
  { label: 'calm', pattern: /\bcalm(?:er|est|ly|ness)?\b/i },
  { label: 'one place', pattern: /\bone place\b/i },
  { label: 'seamless', pattern: /\bseamless(?:ly)?\b/i },
  {
    label: "not X, it's Y",
    pattern:
      /\bnot (?:just )?(?:an?|another) [^.,;—]{1,40}[,;—]\s*(?:it's|it is)\b/i,
  },
];

/** Ceiling on em dashes per 1,000 words of copy in any one file. */
const MAX_EM_DASHES_PER_1000_WORDS = 3;

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/\s.*$/gm, '$1');
}

function stringLiterals(source: string) {
  const literal = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

  return (stripComments(source).match(literal) ?? []).map((value) =>
    value.slice(1, -1),
  );
}

function wordCount(text: string) {
  return text.split(/\s+/).filter((word) => /[a-z]/i.test(word)).length;
}

const files = readdirSync(MARKETING_DIR)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => ({
    name,
    literals: stringLiterals(
      readFileSync(path.join(MARKETING_DIR, name), 'utf8'),
    ),
  }));

describe('marketing copy style', () => {
  it.each(files)('$name avoids banned phrases', ({ literals }) => {
    const hits = literals.flatMap((text) =>
      BANNED.filter(({ pattern }) => pattern.test(text)).map(
        ({ label }) => `${label}: ${text.slice(0, 90)}`,
      ),
    );

    expect(hits).toEqual([]);
  });

  it.each(files)(
    '$name uses at most one em dash per string',
    ({ literals }) => {
      const heavy = literals.filter((text) => text.split('—').length > 2);

      expect(heavy).toEqual([]);
    },
  );

  it.each(files)('$name keeps em dashes rare', ({ literals }) => {
    const copy = literals.join(' ');
    const words = wordCount(copy);
    const dashes = copy.split('—').length - 1;
    const perThousand =
      dashes <= 1 || words === 0 ? 0 : (dashes / words) * 1000;

    expect(
      perThousand,
      `${dashes} em dashes in ${words} words`,
    ).toBeLessThanOrEqual(MAX_EM_DASHES_PER_1000_WORDS);
  });
});
