export type GmailHeader = {
  name?: string | null;
  value?: string | null;
};

export type GmailMessageBody = {
  attachmentId?: string | null;
  size?: number | null;
  data?: string | null;
};

export type GmailMessagePart = {
  partId?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  headers?: GmailHeader[] | null;
  body?: GmailMessageBody | null;
  parts?: GmailMessagePart[] | null;
};

export type GmailMessage = {
  id?: string | null;
  threadId?: string | null;
  labelIds?: string[] | null;
  snippet?: string | null;
  internalDate?: string | null;
  payload?: GmailMessagePart | null;
  historyId?: string | null;
};

export type ParsedGmailMessage = {
  from: string | null;
  to: string[];
  cc: string[];
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  internalDate: string | null;
};

export type BuildRawMessageInput = {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  from?: string;
};

export type GmailHistoryRecord = {
  id?: string | null;
  messages?: Array<{ id?: string | null; threadId?: string | null }> | null;
  messagesAdded?: Array<{
    message?: { id?: string | null; threadId?: string | null } | null;
  }> | null;
  messagesDeleted?: Array<{
    message?: { id?: string | null; threadId?: string | null } | null;
  }> | null;
  labelsAdded?: Array<{
    message?: { id?: string | null; threadId?: string | null } | null;
    labelIds?: string[] | null;
  }> | null;
  labelsRemoved?: Array<{
    message?: { id?: string | null; threadId?: string | null } | null;
    labelIds?: string[] | null;
  }> | null;
};

export type GmailSyncResult = {
  mode: 'backfill' | 'incremental';
  messagesProcessed: number;
  historyId: string | null;
  /** False while first inbox backfill still has unsynced messages. */
  backfillComplete?: boolean;
  /** Approximate messages still to backfill (backfill mode only). */
  remainingEstimate?: number;
};
