import 'server-only';

const IG_VERSION = 'v21.0';
const IG_GRAPH = `https://graph.instagram.com/${IG_VERSION}`;

export class IgGraphApiError extends Error {
  readonly code: number | null;
  readonly subcode: number | null;

  constructor(message: string, code?: number | null, subcode?: number | null) {
    super(redactUrls(message));
    this.name = 'IgGraphApiError';
    this.code = code ?? null;
    this.subcode = subcode ?? null;
  }
}

/** Strip URLs (signed asset URLs, tokens in query strings) from text before it is stored or logged. */
export function redactUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, '[url]');
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

/** Transient: unknown/service errors, throttling, rate limits. */
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

export function isTransientGraphError(error: unknown): boolean {
  if (!(error instanceof IgGraphApiError)) {
    // Network failures (fetch TypeError) are transient.
    return error instanceof TypeError;
  }
  if (error.code !== null && TRANSIENT_CODES.has(error.code)) return true;
  return error.subcode === 2018278;
}

async function graphRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  accessToken: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${IG_GRAPH}/${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    throw parseGraphError(data);
  }
  return data;
}

export async function postPublicCommentReply(
  commentId: string,
  message: string,
  accessToken: string,
): Promise<void> {
  await graphRequest('POST', `${commentId}/replies`, accessToken, { message });
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

export type IgButton =
  | { type: 'postback'; title: string; payload: string }
  | { type: 'web_url'; title: string; url: string };

export type IgQuickReply = {
  content_type: 'text';
  title: string;
  payload: string;
};

export type IgAttachmentType = 'audio' | 'image' | 'video' | 'file';

export type IgRecipient = { id: string } | { comment_id: string };

export type IgOutgoingMessage =
  | { text: string; quick_replies?: IgQuickReply[] }
  | {
      attachment: {
        type: 'template';
        payload: {
          template_type: 'button';
          text: string;
          buttons: IgButton[];
        };
      };
    }
  | {
      attachment: {
        type: IgAttachmentType;
        payload: { attachment_id: string } | { url: string };
      };
    };

type IgMessagePayload = {
  recipient: IgRecipient;
  message: IgOutgoingMessage;
};

export type IgSendResult = { messageId: string | null };

export async function sendIgMessage(
  igBusinessAccountId: string,
  accessToken: string,
  body: IgMessagePayload,
): Promise<IgSendResult> {
  const data = await graphRequest<{ message_id?: string }>(
    'POST',
    `${igBusinessAccountId}/messages`,
    accessToken,
    body,
  );
  return { messageId: data.message_id ?? null };
}

export async function sendTypingIndicator(
  igBusinessAccountId: string,
  recipientIgId: string,
  accessToken: string,
): Promise<void> {
  await graphRequest('POST', `${igBusinessAccountId}/messages`, accessToken, {
    recipient: { id: recipientIgId },
    sender_action: 'typing_on',
  });
}

export async function postPrivateCommentButtonTemplate(
  igBusinessAccountId: string,
  commentId: string,
  text: string,
  buttons: IgButton[],
  accessToken: string,
): Promise<void> {
  await sendIgMessage(igBusinessAccountId, accessToken, {
    recipient: { comment_id: commentId },
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text, buttons },
      },
    },
  });
}

export async function sendDirectButtonTemplate(
  igBusinessAccountId: string,
  recipientIgId: string,
  text: string,
  buttons: IgButton[],
  accessToken: string,
): Promise<void> {
  await sendIgMessage(igBusinessAccountId, accessToken, {
    recipient: { id: recipientIgId },
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text, buttons },
      },
    },
  });
}

/**
 * Upload a media asset once and get a reusable attachment id.
 * The URL is only passed through to Meta; callers must not persist or log it.
 */
export async function uploadMessageAttachment(
  igBusinessAccountId: string,
  accessToken: string,
  params: { type: IgAttachmentType; url: string },
): Promise<string> {
  const data = await graphRequest<{ attachment_id?: string }>(
    'POST',
    `${igBusinessAccountId}/message_attachments`,
    accessToken,
    {
      platform: 'instagram',
      message: {
        attachment: {
          type: params.type,
          payload: { url: params.url, is_reusable: true },
        },
      },
    },
  );
  if (!data.attachment_id) {
    throw new IgGraphApiError('Meta did not return an attachment id');
  }
  return data.attachment_id;
}

export type IgUserProfile = {
  id: string;
  username: string | null;
  name: string | null;
  isUserFollowBusiness: boolean | null;
};

export async function getIgUserProfile(
  igsid: string,
  accessToken: string,
): Promise<IgUserProfile> {
  const data = await graphRequest<{
    id?: string;
    username?: string;
    name?: string;
    is_user_follow_business?: boolean;
  }>('GET', igsid, accessToken, undefined, {
    fields: 'name,username,is_user_follow_business',
  });
  return {
    id: data.id ?? igsid,
    username: data.username ?? null,
    name: data.name ?? null,
    isUserFollowBusiness:
      typeof data.is_user_follow_business === 'boolean'
        ? data.is_user_follow_business
        : null,
  };
}

export type IgMediaItem = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaProductType: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
};

export async function listIgMedia(
  igBusinessAccountId: string,
  accessToken: string,
  limit = 24,
): Promise<IgMediaItem[]> {
  const data = await graphRequest<{
    data?: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      media_product_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      timestamp?: string;
    }>;
  }>('GET', `${igBusinessAccountId}/media`, accessToken, undefined, {
    fields:
      'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp',
    limit: String(limit),
  });
  return (data.data ?? []).map((m) => ({
    id: m.id,
    caption: m.caption ?? null,
    mediaType: m.media_type ?? null,
    mediaProductType: m.media_product_type ?? null,
    thumbnailUrl:
      m.thumbnail_url ??
      (m.media_type === 'IMAGE' ? m.media_url : null) ??
      null,
    permalink: m.permalink ?? null,
    timestamp: m.timestamp ?? null,
  }));
}

export type IgIceBreaker = { question: string; payload: string };

export async function setIceBreakers(
  igBusinessAccountId: string,
  accessToken: string,
  iceBreakers: IgIceBreaker[],
): Promise<void> {
  if (iceBreakers.length === 0) {
    await graphRequest(
      'DELETE',
      `${igBusinessAccountId}/messenger_profile`,
      accessToken,
      { fields: ['ice_breakers'] },
    );
    return;
  }
  await graphRequest(
    'POST',
    `${igBusinessAccountId}/messenger_profile`,
    accessToken,
    {
      platform: 'instagram',
      ice_breakers: [
        {
          locale: 'default',
          call_to_actions: iceBreakers.map((b) => ({
            question: b.question,
            payload: b.payload,
          })),
        },
      ],
    },
  );
}

export type IgMenuItem =
  | { type: 'postback'; title: string; payload: string }
  | { type: 'web_url'; title: string; url: string };

export async function setPersistentMenu(
  igBusinessAccountId: string,
  accessToken: string,
  items: IgMenuItem[],
): Promise<void> {
  if (items.length === 0) {
    await graphRequest(
      'DELETE',
      `${igBusinessAccountId}/messenger_profile`,
      accessToken,
      { fields: ['persistent_menu'] },
    );
    return;
  }
  await graphRequest(
    'POST',
    `${igBusinessAccountId}/messenger_profile`,
    accessToken,
    {
      platform: 'instagram',
      persistent_menu: [
        {
          locale: 'default',
          call_to_actions: items,
        },
      ],
    },
  );
}
