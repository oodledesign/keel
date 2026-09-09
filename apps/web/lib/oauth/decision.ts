const SAFE_REDIRECT_PROTOCOLS = new Set(['http:', 'https:']);

export type OAuthDecision = 'approve' | 'deny';

export type OAuthDecisionFailureReason =
  | 'invalid_form'
  | 'missing_authorization_id'
  | 'invalid_decision'
  | 'untrusted_origin'
  | 'supabase_error'
  | 'missing_redirect'
  | 'already_processed';

export function parseOAuthDecision(
  value: string | null | undefined,
): OAuthDecision | null {
  const decision = value?.trim();
  return decision === 'approve' || decision === 'deny' ? decision : null;
}

export function isUuidLikeAuthorizationId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function getOAuthDecisionRedirectUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;

  for (const key of ['redirect_url', 'redirect_to', 'redirectTo'] as const) {
    const value = record[key];
    if (typeof value === 'string' && isSafeOAuthRedirectUrl(value)) {
      return value;
    }
  }

  return null;
}

export function isSafeOAuthRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return SAFE_REDIRECT_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function allowedOAuthDecisionOrigins(
  request: Request,
  appOrigin: string,
): Set<string> {
  const origins = new Set<string>([appOrigin.replace(/\/+$/, '')]);

  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed request URLs; configured app origin still applies.
  }

  return origins;
}

export function isTrustedOAuthDecisionRequest(
  request: Request,
  appOrigin: string,
): boolean {
  const allowedOrigins = allowedOAuthDecisionOrigins(request, appOrigin);
  const origin = request.headers.get('origin')?.trim();

  if (origin) {
    return allowedOrigins.has(origin);
  }

  const referer = request.headers.get('referer')?.trim();
  if (referer) {
    try {
      return allowedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  const site = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  return site === 'same-origin' || site === 'none';
}

export function wantsJsonOAuthDecisionResponse(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  return accept.includes('application/json') && !accept.includes('text/html');
}

export function summarizeSupabaseAuthError(error: unknown): {
  code: string | null;
  status: number | null;
  name: string | null;
  message: string | null;
} {
  if (!error || typeof error !== 'object') {
    return { code: null, status: null, name: null, message: null };
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : null;
  const name = typeof record.name === 'string' ? record.name : null;
  const message = typeof record.message === 'string' ? record.message : null;
  const status =
    typeof record.status === 'number'
      ? record.status
      : typeof record.statusCode === 'number'
        ? record.statusCode
        : null;

  return { code, status, name, message };
}

export function logOAuthDecisionFailure(input: {
  reason: OAuthDecisionFailureReason;
  decision: string | null;
  authorizationIdPresent: boolean;
  authorizationIdLength: number;
  authorizationIdUuid: boolean;
  supabase?: ReturnType<typeof summarizeSupabaseAuthError>;
  hasRedirectUrl: boolean;
}) {
  console.error('[oauth/decision] consent failed', {
    reason: input.reason,
    decision: input.decision,
    authorizationIdPresent: input.authorizationIdPresent,
    authorizationIdLength: input.authorizationIdLength,
    authorizationIdUuid: input.authorizationIdUuid,
    hasRedirectUrl: input.hasRedirectUrl,
    supabaseCode: input.supabase?.code ?? null,
    supabaseStatus: input.supabase?.status ?? null,
    supabaseName: input.supabase?.name ?? null,
    supabaseMessage: input.supabase?.message ?? null,
  });
}
