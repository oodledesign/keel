import {
  type CaptureKind,
  DEFAULT_OZER_ORIGIN,
  type ExtensionSpeakerEvent,
  type ExtensionWorkspace,
} from './protocol';

export type ExtensionStatus = {
  ok: boolean;
  user_id: string;
  account_id: string;
  workspaces: ExtensionWorkspace[];
};

export type CaptureResult = {
  id: string;
  kind: CaptureKind;
  detail_path: string;
  title: string;
};

function apiUrl(origin: string, path: string) {
  return `${origin.replace(/\/+$/, '')}${path}`;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // ignore
  }
  return `Request failed (${response.status})`;
}

export async function fetchExtensionStatus(
  token: string,
  origin = DEFAULT_OZER_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtensionStatus> {
  const response = await fetchImpl(apiUrl(origin, '/api/extension/v1/status'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as ExtensionStatus;
}

export async function exchangeConnectCode(
  input: { code: string; state: string },
  origin = DEFAULT_OZER_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(
    apiUrl(origin, '/api/recorder/connect/exchange'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error('Connect exchange did not return a token');
  }
  return body.token;
}

export async function captureToOzer(
  token: string,
  input: {
    kind: CaptureKind;
    account_id?: string | null;
    title?: string;
    body?: string;
    url?: string;
    page_title?: string;
    email?: string;
    phone?: string;
  },
  origin = DEFAULT_OZER_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<CaptureResult> {
  const response = await fetchImpl(
    apiUrl(origin, '/api/extension/v1/capture'),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as CaptureResult;
}

export async function postOzerSpeakerEvents(
  token: string,
  input: {
    session_id: string;
    meet_url?: string | null;
    meet_code?: string | null;
    account_id?: string | null;
    events: ExtensionSpeakerEvent[];
  },
  origin = DEFAULT_OZER_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const response = await fetchImpl(
    apiUrl(origin, '/api/extension/v1/speaker-events'),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  return response.ok;
}

export async function extractTasksToOzer(
  token: string,
  input: {
    account_id: string;
    title?: string;
    content: string;
    create_tasks?: boolean;
    events?: ExtensionSpeakerEvent[];
  },
  origin = DEFAULT_OZER_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<{ detail_path: string | null; extract_path: string | null }> {
  const response = await fetchImpl(
    apiUrl(origin, '/api/extension/v1/extract-tasks'),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        create_note: true,
        create_tasks: false,
        ...input,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as {
    detail_path: string | null;
    extract_path: string | null;
  };
}

export function absoluteOzerPath(origin: string, path: string) {
  if (path.startsWith('http')) return path;
  return `${origin.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
