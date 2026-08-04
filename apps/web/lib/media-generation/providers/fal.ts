import 'server-only';

export class FalProviderError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`fal.ai request failed (${status})`);
    this.name = 'FalProviderError';
    this.status = status;
    this.body = body;
  }
}

function falKey(): string {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new Error('FAL_KEY is not configured');
  }
  return key;
}

/**
 * Synchronous fal.run call. Never logs the API key.
 */
export async function falRun<TResponse = unknown>(
  modelId: string,
  input: Record<string, unknown>,
): Promise<TResponse> {
  const res = await fetch(`https://fal.run/${modelId}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new FalProviderError(res.status, text.slice(0, 2000));
  }

  try {
    return JSON.parse(text) as TResponse;
  } catch {
    throw new FalProviderError(res.status, 'Invalid JSON response from fal.ai');
  }
}

/**
 * Queue submit for async models. Returns provider request id for polling.
 */
export async function falQueueSubmit(
  modelId: string,
  input: Record<string, unknown>,
): Promise<{ request_id: string }> {
  const res = await fetch(`https://queue.fal.run/${modelId}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new FalProviderError(res.status, text.slice(0, 2000));
  }

  const json = JSON.parse(text) as { request_id?: string };
  if (!json.request_id) {
    throw new FalProviderError(res.status, 'Missing request_id from fal queue');
  }
  return { request_id: json.request_id };
}

export async function falQueueStatus(
  modelId: string,
  requestId: string,
): Promise<{
  status: string;
  response_url?: string;
}> {
  const res = await fetch(
    `https://queue.fal.run/${modelId}/requests/${requestId}/status`,
    {
      headers: {
        Authorization: `Key ${falKey()}`,
      },
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new FalProviderError(res.status, text.slice(0, 2000));
  }

  return JSON.parse(text) as { status: string; response_url?: string };
}

export async function falQueueResult<TResponse = unknown>(
  modelId: string,
  requestId: string,
): Promise<TResponse> {
  const res = await fetch(
    `https://queue.fal.run/${modelId}/requests/${requestId}`,
    {
      headers: {
        Authorization: `Key ${falKey()}`,
      },
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new FalProviderError(res.status, text.slice(0, 2000));
  }

  return JSON.parse(text) as TResponse;
}
