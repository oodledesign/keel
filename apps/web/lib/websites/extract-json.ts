/**
 * Extract / repair JSON from LLM text responses.
 * Claude sometimes wraps JSON in prose/fences, uses smart quotes,
 * leaves trailing commas, or truncates mid-payload.
 */

function stripCodeFence(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function repairCommonJsonIssues(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

/**
 * Walk from the first `[` or `{` and return the balanced JSON slice,
 * respecting strings/escapes. Returns null when the payload is truncated.
 */
export function extractBalancedJsonSlice(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start === -1) {
    return null;
  }

  const open = text[start]!;
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) {
      depth += 1;
      continue;
    }

    if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function tryParseJson(raw: string): unknown {
  return JSON.parse(repairCommonJsonIssues(raw));
}

export function extractJson<T>(text: string): T {
  const candidate = stripCodeFence(text);
  const attempts: string[] = [];

  const balanced = extractBalancedJsonSlice(candidate);
  if (balanced) {
    attempts.push(balanced);
  }

  attempts.push(candidate.trim());

  const firstBrace = candidate.search(/[[{]/);
  const lastClose = Math.max(
    candidate.lastIndexOf(']'),
    candidate.lastIndexOf('}'),
  );
  if (firstBrace !== -1 && lastClose > firstBrace) {
    attempts.push(candidate.slice(firstBrace, lastClose + 1));
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return tryParseJson(attempt) as T;
    } catch (error) {
      lastError = error;
    }
  }

  if (!balanced && candidate.search(/[[{]/) !== -1) {
    throw new Error(
      'AI response was cut off before the JSON finished. Try again — usually succeeds on retry.',
    );
  }

  const detail =
    lastError instanceof Error ? lastError.message : 'invalid JSON';
  throw new Error(
    `AI returned unreadable JSON (${detail}). Try again, or simplify the brief and regenerate.`,
  );
}
