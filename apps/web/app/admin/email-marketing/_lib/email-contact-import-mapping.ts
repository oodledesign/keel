import type { EmailContactImportFieldKey } from './email-contact-import.schema';
import { EMAIL_CONTACT_IMPORT_FIELD_KEYS } from './email-contact-import.schema';

export type MappedEmailContactRow = Partial<
  Record<EmailContactImportFieldKey, string>
>;

export function applyEmailContactImportMapping(
  row: Record<string, string>,
  mapping: Record<string, string>,
): MappedEmailContactRow {
  const out: MappedEmailContactRow = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (target === '__skip__') continue;
    const key = target as EmailContactImportFieldKey;
    if (!EMAIL_CONTACT_IMPORT_FIELD_KEYS.includes(key)) continue;
    out[key] = row[header] ?? '';
  }
  return out;
}

export function isEmailContactImportRowImportable(
  row: MappedEmailContactRow,
): boolean {
  const first = row.first_name?.trim() ?? '';
  const last = row.last_name?.trim() ?? '';
  const email = row.email?.trim() ?? '';
  return (
    first.length > 0 &&
    last.length > 0 &&
    email.length > 0 &&
    /\S+@\S+\.\S+/.test(email)
  );
}

export function isEmailContactImportMappingComplete(
  mapping: Record<string, string>,
): boolean {
  const required = ['first_name', 'last_name', 'email'] as const;
  for (const field of required) {
    const matches = Object.values(mapping).filter((target) => target === field);
    if (matches.length !== 1) return false;
  }

  const targets = Object.values(mapping).filter(
    (target) => target !== '__skip__',
  );
  const counts = new Map<string, number>();
  for (const target of targets) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count > 1) return false;
  }

  return true;
}

export function countEmailContactRowsMissingRequired(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): number {
  let missing = 0;
  for (const row of rows) {
    if (
      !isEmailContactImportRowImportable(
        applyEmailContactImportMapping(row, mapping),
      )
    ) {
      missing += 1;
    }
  }
  return missing;
}

export function parseImportedSubscribed(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  if (['false', 'no', '0', 'unsubscribed', 'n'].includes(normalized)) {
    return false;
  }
  return true;
}
