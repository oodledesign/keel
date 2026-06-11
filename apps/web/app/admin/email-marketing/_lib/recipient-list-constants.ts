import type { EmailRecipientList } from '~/lib/admin-email/recipient-lists';
import {
  CUSTOM_LIST_KEY_PREFIX,
  customListKey,
  isCustomListKey,
  parseCustomListId,
  type CustomContactListRow,
} from '~/lib/admin-email/recipient-lists';

/** Lists backed by `email_contacts` — editable from the Lists tab. */
export const EDITABLE_RECIPIENT_LISTS = [
  'pre_signup_contacts',
  'beta_contacts',
] as const;

export type EditableRecipientList = (typeof EDITABLE_RECIPIENT_LISTS)[number];

/** System lists where remove = exclusion (contact record kept). */
export const EXCLUDABLE_SYSTEM_LISTS = EDITABLE_RECIPIENT_LISTS;

export type ExcludableSystemList = EditableRecipientList;

export {
  CUSTOM_LIST_KEY_PREFIX,
  customListKey,
  isCustomListKey,
  parseCustomListId,
  type CustomContactListRow,
};

export function isEditableRecipientList(
  list: string,
): list is EditableRecipientList {
  return (EDITABLE_RECIPIENT_LISTS as readonly string[]).includes(list);
}

export function isEditableList(list: string) {
  return isEditableRecipientList(list) || isCustomListKey(list);
}

export function isExcludableSystemList(list: string): list is ExcludableSystemList {
  return (EXCLUDABLE_SYSTEM_LISTS as readonly string[]).includes(list);
}

export function defaultContactSourceForList(
  list: EditableRecipientList,
): 'beta' | 'manual' {
  return list === 'beta_contacts' ? 'beta' : 'manual';
}

export function parseListSelection(value: string | undefined): {
  kind: 'system';
  list: EmailRecipientList;
} | {
  kind: 'custom';
  listId: string;
  listKey: string;
} | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const customId = parseCustomListId(trimmed);
  if (customId) {
    return {
      kind: 'custom',
      listId: customId,
      listKey: trimmed,
    };
  }

  return { kind: 'system', list: trimmed as EmailRecipientList };
}
