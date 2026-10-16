// Env: TYPESAFE_API_KEY (server-side only)
import 'server-only';

/**
 * Minimal client for TypeSafe's Jev "System One" API: typed questions in,
 * structured answers out. Not a text generator — use callAI for prose.
 * Docs: https://docs.typesafe.ai/api
 * Images (experimental): https://docs.typesafe.ai/go/images
 */

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const TYPESAFE_MODEL = 'jev-latest';
const REQUEST_TIMEOUT_MS = 30_000;
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

/** Box needs jev-1.14+ and the images danger-zone header. */
export type TypeSafeBoxQuestion = {
  type: 'box';
  instructions: string | Record<string, unknown>;
};

export type TypeSafeQuestion =
  | TypeSafeNoulQuestion
  | TypeSafeChoiceQuestion
  | TypeSafeScoreQuestion
  | TypeSafeBoxQuestion;

export type TypeSafeImageAsset = {
  type?: 'image';
  format: 'jpg' | 'jpeg' | 'png';
  data_base64: string;
};

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
    }
  | {
      type: 'box';
      top: number;
      bottom: number;
      left: number;
      right: number;
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

function requestUsesImages(input: {
  assets?: Record<string, TypeSafeImageAsset>;
  questions: Record<string, TypeSafeQuestion>;
}) {
  if (input.assets && Object.keys(input.assets).length > 0) return true;
  return Object.values(input.questions).some((q) => q.type === 'box');
}

/**
 * Evaluate one state against many typed questions in a single request.
 * Retries 429/529/5xx with exponential backoff. Throws on failure so callers
 * can fall back to a generative model.
 *
 * Pass `assets` (and use their keys in state/instructions) for experimental
 * image input. That sets `TypeSafe-Danger-Zone-Images: true` automatically.
 */
export async function askTypeSafe(input: {
  state: string | Record<string, unknown> | unknown[];
  questions: Record<string, TypeSafeQuestion>;
  assets?: Record<string, TypeSafeImageAsset>;
  /** Override model (e.g. jev-1.14.0 for Box). Defaults to jev-latest. */
  model?: string;
}): Promise<TypeSafeResult> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY is not configured');
  }

  const useImages = requestUsesImages(input);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (useImages) {
        headers['TypeSafe-Danger-Zone-Images'] = 'true';
      }

      const body: Record<string, unknown> = {
        state: input.state,
        model: input.model ?? TYPESAFE_MODEL,
        questions: input.questions,
      };
      if (input.assets && Object.keys(input.assets).length > 0) {
        body.assets = input.assets;
      }

      const response = await fetch(TYPESAFE_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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

      const errBody = await response.text().catch(() => '');
      lastError = new Error(
        `TypeSafe request failed (${response.status})${errBody ? `: ${errBody.slice(0, 200)}` : ''}`,
      );

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
