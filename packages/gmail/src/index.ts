export { GmailApiError, gmailFetch, gmailFetchPaginated } from './client';
export { createDraft, sendDraft, updateDraft } from './drafts';
export {
  applyLabelIdChanges,
  ensureLabel,
  isManualPickerLabel,
  isSystemLabelId,
  isUserVisibleLabel,
  listLabels,
  modifyThread,
  type GmailLabel,
} from './labels';
export {
  getGmailDefaultSendAs,
  getGmailDefaultSignature,
  type ResolvedEmailSignature,
} from './send-as';
export {
  buildHtmlEmailBody,
  buildRawMessage,
  decodeBase64Url,
  encodeBase64Url,
  htmlSignatureToPlain,
  parseMessage,
  participantsFromMessage,
  plainTextToHtml,
  stripTrailingPlainSignature,
} from './mime';
export {
  backfill,
  incrementalSync,
  syncGmailThread,
  syncMailbox,
} from './sync';
export type {
  BuildRawMessageInput,
  GmailHistoryRecord,
  GmailMessage,
  GmailSyncResult,
  ParsedGmailMessage,
} from './types';
