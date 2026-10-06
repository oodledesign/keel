// Env: TYPESAFE_API_KEY (server-side only)
import 'server-only';

/**
 * Minimal client for TypeSafe's Jev "System One" API: typed questions in,
 * structured answers out. Not a text generator — use callAI for prose.
 * Docs: https://docs.typesafe.ai/api
 */

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const TYPESAFE_MODEL = 'jev-latest';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export type TypeSafeNoulQuestion = {
  type: 'noul';
  instructions: string | Record<string, unknown>;
  criteria?: { true?: string; false?: string };
};

export type TypeSafeChoiceQuestion = {
  type: 'choice';
  instructions: string | Record<string, unknown>;
  /** option -> description (or null). Max 255 options. */
  criteria: Record<string, string | null>;
};

export type TypeSafeScoreQuestion = {
  type: 'score';
  instructions: string | Record<string, unknown>;
  criteria: string[];
};

export type TypeSafeQuestion =
  | TypeSafeNoulQuestion
  | TypeSafeChoiceQuestion
  | TypeSafeScoreQuestion;

export type TypeSafeAnswer =
  | { type: 'noul'; noul: number }
  | {
      type: 'choice';
      choice: string;
      probabilities: Record<string, number>;
      confidence: number;
    }
  | {
      type: 'score';
      score: number;
      probabilities: Record<string, number>;
      confidence: number;
    };

export type TypeSafeResult = {
  answers: Record<string, TypeSafeAnswer>;
};

export function isTypeSafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Evaluate one state against many typed questions in a single request.
 * Retries 429/529/5xx with exponential backoff. Throws on failure so callers
 * can fall back to a generative model.
 */
export async function askTypeSafe(input: {
  state: string | Record<string, unknown> | unknown[];
  questions: Record<string, TypeSafeQuestion>;
}): Promise<TypeSafeResult> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY is not configured');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(TYPESAFE_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: input.state,
          model: TYPESAFE_MODEL,
          questions: input.questions,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          answers?: Record<string, TypeSafeAnswer>;
        };

        if (!json.answers || typeof json.answers !== 'object') {
          throw new Error('TypeSafe returned no answers');
        }

        return { answers: json.answers };
      }

      const retryable =
        response.status === 429 ||
        response.status === 529 ||
        response.status >= 500;

      lastError = new Error(`TypeSafe request failed (${response.status})`);

      if (!retryable) {
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(400 * 2 ** attempt);
    }
  }

  throw lastError ?? new Error('TypeSafe request failed');
}
