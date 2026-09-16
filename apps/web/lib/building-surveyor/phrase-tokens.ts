export type PhraseToken =
  | {
      type: 'text';
      value: string;
    }
  | {
      type: 'choice';
      raw: string;
      options: string[];
      defaultIndex: number | null;
    }
  | {
      type: 'describe';
      raw: string;
      label: string;
    };

const TOKEN_RE = /\|\|([^|]+)\|\|/g;

function looksLikeChoices(inner: string): boolean {
  const trimmed = inner.trim();
  if (!trimmed.includes('/')) return false;
  const parts = trimmed.split('/').map((part) => part.trim());
  return (
    parts.length >= 2 &&
    parts.every((part) => part.length > 0 && part.length < 80)
  );
}

function parseChoiceInner(inner: string): PhraseToken {
  const parts = inner.split('/').map((part) => part.trim());
  let defaultIndex: number | null = null;
  const options = parts
    .map((part, index) => {
      const starred = part.startsWith('*') || part.endsWith('*');
      const cleaned = part.replace(/^\*+|\*+$/g, '').trim();
      if (starred && defaultIndex === null && cleaned) {
        defaultIndex = index;
      }
      return cleaned;
    })
    .filter(Boolean);

  return {
    type: 'choice',
    raw: inner,
    options,
    defaultIndex,
  };
}

export function parsePhraseTokens(body: string): PhraseToken[] {
  const tokens: PhraseToken[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;

  for (const match of body.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      tokens.push({ type: 'text', value: body.slice(last, index) });
    }
    const inner = match[1] ?? '';
    if (looksLikeChoices(inner)) {
      tokens.push(parseChoiceInner(inner));
    } else {
      const label = inner.replace(/^\*+|\*+$/g, '').trim() || 'describe';
      tokens.push({ type: 'describe', raw: inner, label });
    }
    last = index + match[0].length;
  }

  if (last < body.length) {
    tokens.push({ type: 'text', value: body.slice(last) });
  }

  return tokens;
}

export function resolvePhraseBody(
  body: string,
  answers: Array<string | null | undefined> = [],
): string {
  const tokens = parsePhraseTokens(body);
  let answerIndex = 0;
  return tokens
    .map((token) => {
      if (token.type === 'text') return token.value;
      const answer = answers[answerIndex]?.trim() ?? '';
      answerIndex += 1;
      if (answer) return answer;
      if (token.type === 'choice' && token.defaultIndex !== null) {
        return token.options[token.defaultIndex] ?? '';
      }
      return token.type === 'describe' ? `[${token.label}]` : '';
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function phraseHasTokens(body: string): boolean {
  return parsePhraseTokens(body).some((token) => token.type !== 'text');
}
