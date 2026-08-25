import 'server-only';

const IG_VERSION = 'v21.0';
const IG_GRAPH = `https://graph.instagram.com/${IG_VERSION}`;

export class IgGraphApiError extends Error {
  readonly code: number | null;
  readonly subcode: number | null;

  constructor(message: string, code?: number | null, subcode?: number | null) {
    super(message);
    this.name = 'IgGraphApiError';
    this.code = code ?? null;
    this.subcode = subcode ?? null;
  }
}

function parseGraphError(data: unknown): IgGraphApiError {
  const row = data as {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  const err = row.error;
  return new IgGraphApiError(
    err?.message ?? 'Instagram Graph API error',
    err?.code ?? null,
    err?.error_subcode ?? null,
  );
}

export function isDmWindowExpiredError(error: unknown): boolean {
  if (!(error instanceof IgGraphApiError)) return false;
  if (error.code === 10 || error.code === 200) return true;
  if (error.subcode === 10903) return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('outside of allowed window') ||
    msg.includes('cannot reply to this comment') ||
    msg.includes('expired') ||
    msg.includes('older than 7 days')
  );
}

export async function postPublicCommentReply(
  commentId: string,
  message: string,
  accessToken: string,
): Promise<void> {
  const url = new URL(`${IG_GRAPH}/${commentId}/replies`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw parseGraphError(data);
  }
}

export async function postPrivateCommentReply(
  igBusinessAccountId: string,
  commentId: string,
  message: string,
  accessToken: string,
): Promise<void> {
  const url = new URL(`${IG_GRAPH}/${igBusinessAccountId}/messages`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: message },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw parseGraphError(data);
  }
}
