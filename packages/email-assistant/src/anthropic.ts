import 'server-only';

/** Retired 2026-06-15 — use claude-sonnet-4-6 (override via ANTHROPIC_MODEL). */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your environment to use the email assistant.',
    );
  }

  const model =
    process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;

  return { apiKey, model };
}

export async function callAnthropicText(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const { apiKey, model } = getAnthropicConfig();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens ?? 2048,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API error (${response.status}): ${(await response.text()).slice(0, 400)}`,
    );
  }

  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = body.content?.find((block) => block.type === 'text')?.text?.trim();

  if (!text) {
    throw new Error('Empty response from Anthropic');
  }

  return text;
}
