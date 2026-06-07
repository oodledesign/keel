import 'server-only';

import { delay } from '~/lib/clusters/utils';

const BASE_URL = 'https://api.dataforseo.com/v3';
const LIVE_GAP_MS = 400;

/** Serializes DataForSEO *\/live requests — account allows one live task at a time. */
let liveSerial: Promise<unknown> = Promise.resolve();

function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();

  if (!login || !password) {
    throw new Error(
      'DataForSEO is not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
    );
  }

  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

export type DfsResponse = {
  tasks?: Array<{
    id?: string;
    status_code?: number;
    status_message?: string;
    data?: Record<string, unknown>;
    result?: Array<Record<string, unknown>>;
  }>;
};

export function isDfsLivePath(path: string): boolean {
  return path.includes('/live');
}

export function isDfsAccessDenied(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('access denied') ||
    lower.includes('backlinks-subscription') ||
    lower.includes('activate your subscription')
  );
}

async function dfsPostImmediate<T = DfsResponse>(
  path: string,
  body: unknown[],
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO ${path} failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as T & {
    tasks?: Array<{ status_code?: number; status_message?: string }>;
  };

  const taskError = json.tasks?.find(
    (task) => task.status_code && task.status_code >= 40000,
  );
  if (taskError?.status_message) {
    throw new Error(`DataForSEO task error: ${taskError.status_message}`);
  }

  return json;
}

export async function dfsPost<T = DfsResponse>(
  path: string,
  body: unknown[],
): Promise<T> {
  if (isDfsLivePath(path) && body.length !== 1) {
    throw new Error(
      `DataForSEO live endpoint ${path} accepts exactly one task per request (got ${body.length})`,
    );
  }

  if (!isDfsLivePath(path)) {
    return dfsPostImmediate<T>(path, body);
  }

  const run = liveSerial.then(() => dfsPostImmediate<T>(path, body));
  liveSerial = run
    .then(async () => {
      await delay(LIVE_GAP_MS);
    })
    .catch(async () => {
      await delay(LIVE_GAP_MS);
    });

  return run;
}

export async function dfsGetUserBalance(): Promise<number | null> {
  try {
    const json = await dfsPost('/appendix/user_data', []);
    const balance = json.tasks?.[0]?.result?.[0] as
      | { money?: { balance?: number } }
      | undefined;
    return balance?.money?.balance ?? null;
  } catch {
    return null;
  }
}
