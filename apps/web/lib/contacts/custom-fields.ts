/** Workspace-defined custom fields on contacts (`clients`). Client-safe. */

export const CONTACT_CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'checkbox',
] as const;

export type ContactCustomFieldType =
  (typeof CONTACT_CUSTOM_FIELD_TYPES)[number];

export const CONTACT_CUSTOM_FIELD_TYPE_LABELS: Record<
  ContactCustomFieldType,
  string
> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Choice',
  checkbox: 'Yes / no',
};

export type ContactCustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  fieldType: ContactCustomFieldType;
  options: string[];
  position: number;
};

export type ContactCustomFieldValue = string | number | boolean;
export type ContactCustomFieldValues = Record<string, ContactCustomFieldValue>;

export const CONTACT_CUSTOM_FIELD_MAX = 40;

const KEY_RE = /^[a-z][a-z0-9_]{0,59}$/;

/** Keys that would shadow built-in contact columns / form semantics. */
const RESERVED_KEYS = new Set([
  'id',
  'name',
  'email',
  'phone',
  'company',
  'company_name',
  'message',
  'marketing_opt_in',
]);

export function isValidContactFieldKey(key: string): boolean {
  return KEY_RE.test(key) && !RESERVED_KEYS.has(key);
}

export function slugifyContactFieldKey(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  const key = /^[a-z]/.test(base) ? base : `f_${base}`;
  return RESERVED_KEYS.has(key) ? `${key}_custom` : key;
}

export function uniqueContactFieldKey(
  label: string,
  existingKeys: Iterable<string>,
): string {
  const taken = new Set(existingKeys);
  const base = slugifyContactFieldKey(label) || 'custom_field';
  if (!taken.has(base)) return base;
  for (let index = 2; index < 200; index += 1) {
    const candidate = `${base.slice(0, 55)}_${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 40)}_${Date.now()}`;
}

/**
 * Coerce a raw (form / UI) value for a definition. Returns null when the
 * value is empty or invalid so callers can skip or clear it.
 */
export function coerceContactFieldValue(
  definition: Pick<ContactCustomFieldDefinition, 'fieldType' | 'options'>,
  raw: unknown,
): ContactCustomFieldValue | null {
  switch (definition.fieldType) {
    case 'checkbox': {
      if (raw === true || raw === 'true' || raw === 'on' || raw === '1') {
        return true;
      }
      if (raw === false || raw === 'false' || raw === '0') return false;
      if (typeof raw === 'string') {
        const normalized = raw.trim().toLowerCase();
        if (normalized === 'yes') return true;
        if (normalized === 'no') return false;
      }
      return null;
    }
    case 'number': {
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw !== 'string' || !raw.trim()) return null;
      const numeric = Number(raw.replace(/[,\s£$€]/g, ''));
      return Number.isFinite(numeric) ? numeric : null;
    }
    case 'date': {
      if (typeof raw !== 'string') return null;
      const value = raw.trim().slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value))
        ? value
        : null;
    }
    case 'select': {
      if (typeof raw !== 'string') return null;
      const value = raw.trim();
      if (!value) return null;
      if (definition.options.length === 0) return value.slice(0, 200);
      return (
        definition.options.find(
          (option) => option.toLowerCase() === value.toLowerCase(),
        ) ?? null
      );
    }
    default: {
      if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
      if (typeof raw !== 'string') return null;
      const value = raw.trim().slice(0, 500);
      return value || null;
    }
  }
}

/** Keep only known keys with valid values. */
export function sanitizeContactCustomValues(
  definitions: ContactCustomFieldDefinition[],
  raw: Record<string, unknown>,
): ContactCustomFieldValues {
  const out: ContactCustomFieldValues = {};
  for (const definition of definitions) {
    if (!(definition.key in raw)) continue;
    const value = coerceContactFieldValue(definition, raw[definition.key]);
    if (value !== null) out[definition.key] = value;
  }
  return out;
}

/** Map a form field type to the closest contact custom field type. */
export function contactFieldTypeForFormField(
  type: string,
): ContactCustomFieldType {
  switch (type) {
    case 'checkbox':
    case 'yes_no':
      return 'checkbox';
    case 'date':
      return 'date';
    case 'select':
    case 'radio':
      return 'select';
    default:
      return 'text';
  }
}

export function formatContactFieldValue(
  value: ContactCustomFieldValue | undefined,
): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
