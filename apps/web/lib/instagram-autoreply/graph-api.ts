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
  await sendIgMessage(igBusinessAccountId, accessToken, {
    recipient: { comment_id: commentId },
    message: { text: message },
  });
}

type IgMessagePayload = {
  recipient: { id: string } | { comment_id: string };
  message:
    | { text: string }
    | {
        attachment: {
          type: 'template';
          payload: {
            template_type: 'button';
            text: string;
            buttons: Array<
              | { type: 'postback'; title: string; payload: string }
              | { type: 'web_url'; title: string; url: string }
            >;
          };
        };
      };
};

async function sendIgMessage(
  igBusinessAccountId: string,
  accessToken: string,
  body: IgMessagePayload,
): Promise<void> {
  const url = new URL(`${IG_GRAPH}/${igBusinessAccountId}/messages`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw parseGraphError(data);
  }
}

export async function postPrivateCommentButtonTemplate(
  igBusinessAccountId: string,
  commentId: string,
  text: string,
  buttons: Array<
    | { type: 'postback'; title: string; payload: string }
    | { type: 'web_url'; title: string; url: string }
  >,
  accessToken: string,
): Promise<void> {
  await sendIgMessage(igBusinessAccountId, accessToken, {
    recipient: { comment_id: commentId },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons,
        },
      },
    },
  });
}

export async function sendDirectButtonTemplate(
  igBusinessAccountId: string,
  recipientIgId: string,
  text: string,
  buttons: Array<
    | { type: 'postback'; title: string; payload: string }
    | { type: 'web_url'; title: string; url: string }
  >,
  accessToken: string,
): Promise<void> {
  await sendIgMessage(igBusinessAccountId, accessToken, {
    recipient: { id: recipientIgId },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons,
        },
      },
    },
  });
}
