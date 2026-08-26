import 'server-only';

import type { MailboxKind } from '@kit/google-auth';

import { gmailFetch } from './client';

export type GmailLabel = {
  id: string;
  name: string;
  type: 'system' | 'user';
  messageListVisibility?: string | null;
  labelListVisibility?: string | null;
};

type ListLabelsResponse = {
  labels?: Array<{
    id?: string | null;
    name?: string | null;
    type?: string | null;
    messageListVisibility?: string | null;
    labelListVisibility?: string | null;
  }> | null;
};

type CreateLabelResponse = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
};

type ModifyThreadResponse = {
  id?: string | null;
  messages?: Array<{ id?: string | null; labelIds?: string[] | null }> | null;
};

/** Gmail system label IDs that are not useful as user-facing chips/filters. */
const HIDDEN_SYSTEM_LABEL_IDS = new Set([
  'CHAT',
  'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
  'UNREAD',
  'DRAFT',
  'SENT',
  'SPAM',
  'TRASH',
  'YELLOW_STAR',
  'BLUE_STAR',
  'RED_STAR',
  'ORANGE_STAR',
  'GREEN_STAR',
  'PURPLE_STAR',
  'RED_BANG',
  'YELLOW_BANG',
  'BLUE_INFO',
  'GREEN_CHECK',
  'PURPLE_QUESTION',
  'ORANGE_GUY',
]);

/** System labels that may still be shown as status (inbox / star / important). */
const STATUS_SYSTEM_LABEL_IDS = new Set(['INBOX', 'STARRED', 'IMPORTANT']);

export function isSystemLabelId(labelId: string): boolean {
  return (
    STATUS_SYSTEM_LABEL_IDS.has(labelId) ||
    HIDDEN_SYSTEM_LABEL_IDS.has(labelId) ||
    labelId.startsWith('CATEGORY_')
  );
}

export function isUserVisibleLabel(label: Pick<GmailLabel, 'id' | 'type' | 'name'>): boolean {
  if (label.type === 'user') {
    return true;
  }

  return STATUS_SYSTEM_LABEL_IDS.has(label.id);
}

/** Labels suitable for the manual picker (user labels only; Ozer/* owned by triage). */
export function isManualPickerLabel(label: Pick<GmailLabel, 'id' | 'type' | 'name'>): boolean {
  if (label.type !== 'user') {
    return false;
  }

  return !label.name.startsWith('Ozer/');
}

export async function listLabels(
  userId: string,
  mailboxKind: MailboxKind = 'business',
): Promise<GmailLabel[]> {
  const response = await gmailFetch<ListLabelsResponse>(
    userId,
    '/labels',
    undefined,
    mailboxKind,
  );

  const labels: GmailLabel[] = [];

  for (const row of response.labels ?? []) {
    const id = row.id?.trim();
    const name = row.name?.trim();

    if (!id || !name) {
      continue;
    }

    labels.push({
      id,
      name,
      type: row.type === 'system' ? 'system' : 'user',
      messageListVisibility: row.messageListVisibility ?? null,
      labelListVisibility: row.labelListVisibility ?? null,
    });
  }

  return labels;
}

export async function ensureLabel(
  userId: string,
  name: string,
  mailboxKind: MailboxKind = 'business',
): Promise<GmailLabel> {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error('Label name is required');
  }

  const existing = await listLabels(userId, mailboxKind);
  const match = existing.find(
    (label) => label.name.toLowerCase() === trimmed.toLowerCase(),
  );

  if (match) {
    return match;
  }

  const created = await gmailFetch<CreateLabelResponse>(
    userId,
    '/labels',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: trimmed,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    },
    mailboxKind,
  );

  const id = created.id?.trim();
  const createdName = created.name?.trim() || trimmed;

  if (!id) {
    throw new Error(`Failed to create Gmail label "${trimmed}"`);
  }

  return {
    id,
    name: createdName,
    type: 'user',
  };
}

export async function modifyThread(
  userId: string,
  gmailThreadId: string,
  input: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  },
  mailboxKind: MailboxKind = 'business',
): Promise<ModifyThreadResponse> {
  const addLabelIds = [...new Set((input.addLabelIds ?? []).filter(Boolean))];
  const removeLabelIds = [
    ...new Set((input.removeLabelIds ?? []).filter(Boolean)),
  ];

  if (addLabelIds.length === 0 && removeLabelIds.length === 0) {
    return { id: gmailThreadId };
  }

  return gmailFetch<ModifyThreadResponse>(
    userId,
    `/threads/${encodeURIComponent(gmailThreadId)}/modify`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        addLabelIds,
        removeLabelIds,
      }),
    },
    mailboxKind,
  );
}

/** Apply add/remove to a local label_ids array (optimistic DB mirror). */
export function applyLabelIdChanges(
  current: string[] | null | undefined,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): string[] {
  const remove = new Set(removeLabelIds);
  const next = new Set(
    (current ?? []).filter((id) => id && !remove.has(id)),
  );

  for (const id of addLabelIds) {
    if (id) {
      next.add(id);
    }
  }

  return [...next];
}
