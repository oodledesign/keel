import 'server-only';

import {
  type RightmoveEnvironment,
  getRightmoveEnv,
  isRightmoveOAuthConfigured,
} from './rightmove-env';
import type {
  RemoveCommercialProperty,
  RightmovePropertyPayload,
  RightmovePropertySaveAction,
  RightmoveRemovalReason,
} from './rightmove-types';

export type RightmoveToken = {
  accessToken: string;
  tokenType: string;
  expiresIn: number | null;
  obtainedAt: number;
};

export type RightmoveConnectionTestResult = {
  ok: boolean;
  environment: RightmoveEnvironment;
  message: string;
  expiresIn: number | null;
  branchListingCount?: number | null;
};

let cachedToken: RightmoveToken | null = null;

function basicAuthHeader(clientId: string, clientKey: string) {
  const credentials = Buffer.from(`${clientId}:${clientKey}`, 'utf8').toString(
    'base64',
  );
  return `Basic ${credentials}`;
}

export class RightmoveApiError extends Error {
  readonly status: number;
  readonly rawBody: string;

  constructor(message: string, status: number, rawBody: string) {
    super(message);
    this.name = 'RightmoveApiError';
    this.status = status;
    this.rawBody = rawBody;
  }
}

function formatValidationErrors(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const field =
          (typeof row.field === 'string' && row.field) ||
          (typeof row.path === 'string' && row.path) ||
          (typeof row.pointer === 'string' && row.pointer) ||
          (typeof row.property === 'string' && row.property) ||
          null;
        const message =
          (typeof row.message === 'string' && row.message) ||
          (typeof row.defaultMessage === 'string' && row.defaultMessage) ||
          (typeof row.error === 'string' && row.error) ||
          (typeof row.detail === 'string' && row.detail) ||
          null;
        if (field && message) return `${field}: ${message}`;
        return message || field;
      })
      .filter((part): part is string => Boolean(part?.trim()));
    return parts.length ? parts.join('; ') : null;
  }

  if (typeof value === 'object') {
    const row = value as Record<string, unknown>;
    // Nested property-errors map: { "building.pricing.price": ["must be …"] }
    const entries = Object.entries(row).flatMap(([key, val]) => {
      if (typeof val === 'string') return [`${key}: ${val}`];
      if (Array.isArray(val)) {
        return val
          .filter(
            (v): v is string => typeof v === 'string' && Boolean(v.trim()),
          )
          .map((v) => `${key}: ${v}`);
      }
      return [];
    });
    if (entries.length) return entries.join('; ');

    return (
      formatValidationErrors(row.errors) ||
      formatValidationErrors(row.violations) ||
      formatValidationErrors(row.fieldErrors) ||
      formatValidationErrors(row.messages)
    );
  }

  return null;
}

/**
 * Parse Rightmove RFC 7807 ProblemDetail (and common nested validation payloads)
 * into a short human-readable error string.
 */
export function parseProblemDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      title?: string;
      detail?: string;
      status?: number;
      type?: string;
      errors?: unknown;
      violations?: unknown;
      properties?: {
        validationError?: unknown;
        errors?: unknown;
        violations?: unknown;
        traceId?: string;
      };
    };

    const validation =
      formatValidationErrors(parsed.properties?.validationError) ||
      formatValidationErrors(parsed.properties?.errors) ||
      formatValidationErrors(parsed.properties?.violations) ||
      formatValidationErrors(parsed.errors) ||
      formatValidationErrors(parsed.violations);

    const parts = [parsed.title, parsed.detail, validation].filter(
      (part): part is string => Boolean(part?.trim()),
    );
    if (parts.length) return parts.join(' — ');
  } catch {
    // fall through
  }
  return body.slice(0, 400) || 'Unknown Rightmove API error';
}

/**
 * Request an access token using client credentials (Basic auth).
 * Tokens are cached in-process until shortly before expiry.
 */
export async function getRightmoveAccessToken(
  forceRefresh = false,
): Promise<RightmoveToken> {
  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.expiresIn != null &&
    Date.now() <
      cachedToken.obtainedAt + Math.max(30, cachedToken.expiresIn - 60) * 1000
  ) {
    return cachedToken;
  }

  const env = getRightmoveEnv();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
  });

  const response = await fetch(env.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(env.clientId, env.clientKey),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Rightmove token request failed (${response.status}): ${parseProblemDetail(text)}`,
    );
  }

  let json: {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error('Rightmove token response was not valid JSON');
  }

  if (!json.access_token) {
    throw new Error('Rightmove token response missing access_token');
  }

  cachedToken = {
    accessToken: json.access_token,
    tokenType: json.token_type ?? 'Bearer',
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : null,
    obtainedAt: Date.now(),
  };

  return cachedToken;
}

export async function rightmoveFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const env = getRightmoveEnv();
  const token = await getRightmoveAccessToken();
  const url = path.startsWith('http')
    ? path
    : `${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token.accessToken}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  return fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

/**
 * Prove OAuth works. Optionally probe GET /v2/property/commercial/branch?id=
 * when a workspace Branch ID is provided.
 */
export async function testRightmoveConnection(input?: {
  branchId?: string | null;
}): Promise<RightmoveConnectionTestResult> {
  if (!isRightmoveOAuthConfigured()) {
    return {
      ok: false,
      environment: 'test',
      message:
        'RIGHTMOVE_CLIENT_ID / RIGHTMOVE_CLIENT_KEY are not set on the server',
      expiresIn: null,
    };
  }

  const env = getRightmoveEnv();
  const token = await getRightmoveAccessToken(true);

  const branchId = input?.branchId?.trim();
  if (!branchId) {
    return {
      ok: true,
      environment: env.environment,
      message: `Rightmove OAuth OK (${env.environment}). Save a Branch ID to also probe the branch listings endpoint.`,
      expiresIn: token.expiresIn,
      branchListingCount: null,
    };
  }

  const numericBranch = Number(branchId);
  if (!Number.isFinite(numericBranch)) {
    return {
      ok: false,
      environment: env.environment,
      message: 'Branch ID must be a numeric Rightmove branch id',
      expiresIn: token.expiresIn,
    };
  }

  const response = await rightmoveFetch(
    `/v2/property/commercial/branch?id=${encodeURIComponent(String(numericBranch))}&page=0&size=1`,
    { method: 'GET' },
  );
  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      environment: env.environment,
      message: `OAuth OK, but branch probe failed (${response.status}): ${parseProblemDetail(text)}`,
      expiresIn: token.expiresIn,
    };
  }

  let count: number | null = null;
  try {
    const parsed = JSON.parse(text) as {
      content?: unknown[];
      totalElements?: number;
      properties?: unknown[];
    };
    if (typeof parsed.totalElements === 'number') {
      count = parsed.totalElements;
    } else if (Array.isArray(parsed.content)) {
      count = parsed.content.length;
    } else if (Array.isArray(parsed.properties)) {
      count = parsed.properties.length;
    }
  } catch {
    count = null;
  }

  return {
    ok: true,
    environment: env.environment,
    message:
      count != null
        ? `Rightmove OAuth + branch probe OK (${env.environment}). Branch returned ${count} listing(s).`
        : `Rightmove OAuth + branch probe OK (${env.environment}).`,
    expiresIn: token.expiresIn,
    branchListingCount: count,
  };
}

export type RightmovePutResult = {
  status: number;
  created: boolean;
  body: RightmovePropertySaveAction | null;
  raw: string;
  displayUrl: string | null;
  traceId: string | null;
};

export type RightmoveDeleteResult = {
  status: number;
  ok: boolean;
  raw: string;
};

function firstDisplayPath(
  display: Record<string, string> | Record<string, unknown> | undefined,
): string | null {
  if (!display || typeof display !== 'object') return null;
  for (const value of Object.values(display)) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      const link =
        nested.buildingDisplayLink ??
        nested.spaceDisplayLink ??
        nested.selfLink;
      if (typeof link === 'string' && link.trim()) return link.trim();
    }
  }
  return null;
}

function absoluteRightmoveDisplayUrl(pathOrUrl: string | null): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `https://www.rightmove.co.uk${path}`;
}

/**
 * Create or update a commercial property (PUT /v2/property/commercial/{reference}).
 */
export async function putCommercialProperty(input: {
  reference: string;
  payload: RightmovePropertyPayload;
}): Promise<RightmovePutResult> {
  const reference = encodeURIComponent(input.reference);
  const response = await rightmoveFetch(
    `/v2/property/commercial/${reference}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
    },
  );

  const raw = await response.text();
  let body: RightmovePropertySaveAction | null = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as RightmovePropertySaveAction;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new RightmoveApiError(
      `Rightmove PUT failed (${response.status}): ${parseProblemDetail(raw)}`,
      response.status,
      raw,
    );
  }

  const displayPath = firstDisplayPath(body?.data?.links?.display?.building);
  return {
    status: response.status,
    created: response.status === 201,
    body,
    raw,
    displayUrl: absoluteRightmoveDisplayUrl(displayPath),
    traceId: body?.meta?.traceId ?? null,
  };
}

/**
 * Permanently remove a commercial property from Rightmove.
 */
export async function deleteCommercialProperty(input: {
  reference: string;
  agentId: number;
  removalReason: RightmoveRemovalReason;
}): Promise<RightmoveDeleteResult> {
  const reference = encodeURIComponent(input.reference);
  const response = await rightmoveFetch(
    `/v2/property/commercial/${reference}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: input.agentId,
        removalReason: input.removalReason,
      } satisfies RemoveCommercialProperty),
    },
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new RightmoveApiError(
      `Rightmove DELETE failed (${response.status}): ${parseProblemDetail(raw)}`,
      response.status,
      raw,
    );
  }

  return { status: response.status, ok: true, raw };
}
