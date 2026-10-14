export const IG_MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Private Replies must be sent within 7 days of the comment. */
export const IG_PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isWithinMessagingWindow(
  lastInboundAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastInboundAt) return false;
  const last = Date.parse(lastInboundAt);
  if (!Number.isFinite(last)) return false;
  return now.getTime() - last < IG_MESSAGING_WINDOW_MS;
}

export type IgRecipientChoice =
  | { kind: 'direct' }
  | { kind: 'private_reply'; commentId: string }
  | { kind: 'closed' };

/**
 * Decide how the next message can reach the user:
 * - inside the 24h window → normal DM
 * - otherwise, an unused Private Reply for a comment < 7 days old
 * - otherwise the window is closed and nothing may be sent
 */
export function chooseRecipient(params: {
  lastInboundAt: string | null;
  sourceCommentId: string | null;
  privateReplyUsed: boolean;
  runCreatedAt: string;
  now?: Date;
}): IgRecipientChoice {
  const now = params.now ?? new Date();
  if (!params.privateReplyUsed && params.sourceCommentId) {
    const createdAt = Date.parse(params.runCreatedAt);
    if (
      Number.isFinite(createdAt) &&
      now.getTime() - createdAt < IG_PRIVATE_REPLY_WINDOW_MS
    ) {
      return { kind: 'private_reply', commentId: params.sourceCommentId };
    }
  }
  if (isWithinMessagingWindow(params.lastInboundAt, now)) {
    return { kind: 'direct' };
  }
  return { kind: 'closed' };
}

/** Retry backoff for transient Meta errors: 1, 5 then 15 minutes. */
export const IG_RETRY_BACKOFF_MINUTES = [1, 5, 15] as const;

export function nextRetryAt(attempts: number, now: Date = new Date()) {
  const minutes = IG_RETRY_BACKOFF_MINUTES[attempts - 1];
  if (minutes === undefined) return null;
  return new Date(now.getTime() + minutes * 60_000);
}
