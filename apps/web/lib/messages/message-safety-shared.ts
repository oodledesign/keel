import { z } from 'zod';

export const MESSAGE_REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate',
  'other',
] as const;

export type MessageReportReason = (typeof MESSAGE_REPORT_REASONS)[number];

export const MESSAGE_REPORT_REASON_LABELS: Record<MessageReportReason, string> =
  {
    spam: 'Spam',
    harassment: 'Harassment or abuse',
    inappropriate: 'Inappropriate content',
    other: 'Something else',
  };

export type MessageReportSource = 'ios' | 'web' | 'mac';

export const MESSAGE_REPORT_SOURCE_LABELS: Record<MessageReportSource, string> =
  {
    ios: 'the Ozer iPhone/iPad app',
    web: 'the Ozer web app',
    mac: 'Ozer Assistant for Mac',
  };

const ReportDetailsSchema = z
  .string()
  .max(2000)
  .optional()
  .transform((value) => value?.trim() || undefined);

export const NativeReportMessageBodySchema = z.object({
  workspace: z.string().min(1),
  thread_id: z.string().uuid(),
  message_id: z.string().uuid().optional(),
  reason: z.enum(MESSAGE_REPORT_REASONS),
  details: ReportDetailsSchema,
  block: z.boolean().optional().default(false),
});

export const NativeBlockUserBodySchema = z.object({
  user_id: z.string().uuid(),
});

export const ReportChatMessageSchema = z.object({
  accountId: z.string().uuid(),
  threadId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  reason: z.enum(MESSAGE_REPORT_REASONS),
  details: ReportDetailsSchema,
  block: z.boolean().default(false),
});

export const ChatUserIdSchema = z.object({
  userId: z.string().uuid(),
});

export type BlockedChatUser = {
  user_id: string;
  display_name: string;
  created_at: string;
};

/** A direct thread with a blocked person disappears from the blocker's inbox. */
export function isDirectThreadWithBlockedUser(
  thread: {
    type: string;
    participants: Array<{ user_id: string | null }>;
  },
  blocked: ReadonlySet<string>,
  viewerUserId: string,
): boolean {
  if (thread.type !== 'direct' || blocked.size === 0) return false;
  const others = thread.participants
    .map((participant) => participant.user_id)
    .filter((id): id is string => Boolean(id) && id !== viewerUserId);
  return others.length > 0 && others.every((id) => blocked.has(id));
}

/** Drop push/in-app/email recipients who blocked the sender. */
export function recipientsAfterBlocks(params: {
  userIds: string[];
  emails: string[];
  blockerUserIds: ReadonlySet<string>;
  emailByUserId: ReadonlyMap<string, string | null | undefined>;
}): { userIds: string[]; emails: string[] } {
  if (params.blockerUserIds.size === 0) {
    return { userIds: params.userIds, emails: params.emails };
  }
  const blockedEmails = new Set(
    [...params.blockerUserIds]
      .map((id) => params.emailByUserId.get(id)?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );
  return {
    userIds: params.userIds.filter((id) => !params.blockerUserIds.has(id)),
    emails: params.emails.filter(
      (email) => !blockedEmails.has(email.trim().toLowerCase()),
    ),
  };
}
