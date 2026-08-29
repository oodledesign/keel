export const WORKSPACE_FORM_FIELD_TYPES = [
  'name',
  'email',
  'phone',
  'message',
  'text',
  'textarea',
  'select',
  'checkbox',
  'hidden',
] as const;

export type WorkspaceFormFieldType =
  (typeof WORKSPACE_FORM_FIELD_TYPES)[number];

export const WORKSPACE_FORM_DESTINATIONS = [
  'pipeline',
  'listing_enquiry',
] as const;

export type WorkspaceFormDestination =
  (typeof WORKSPACE_FORM_DESTINATIONS)[number];

export const WORKSPACE_FORM_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;

export type WorkspaceFormStatus = (typeof WORKSPACE_FORM_STATUSES)[number];

export type WorkspaceFormField = {
  id: string;
  type: WorkspaceFormFieldType;
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
};

export const WORKSPACE_FORM_DESTINATION_LABELS: Record<
  WorkspaceFormDestination,
  string
> = {
  pipeline: 'Create pipeline enquiry',
  listing_enquiry: 'Create enquiry for a listing',
};

export const WORKSPACE_FORM_FIELD_TYPE_LABELS: Record<
  WorkspaceFormFieldType,
  string
> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  message: 'Message',
  text: 'Short text',
  textarea: 'Long text',
  select: 'Dropdown',
  checkbox: 'Checkbox',
  hidden: 'Hidden / pre-filled',
};

const SEMANTIC_KEYS = new Set([
  'name',
  'email',
  'phone',
  'message',
  'listing_id',
]);

export function defaultWorkspaceFormFields(): WorkspaceFormField[] {
  return [
    {
      id: 'name',
      type: 'name',
      key: 'name',
      label: 'Name',
      required: true,
      placeholder: 'Your name',
    },
    {
      id: 'email',
      type: 'email',
      key: 'email',
      label: 'Email',
      required: true,
      placeholder: 'you@example.com',
    },
    {
      id: 'phone',
      type: 'phone',
      key: 'phone',
      label: 'Phone',
      required: false,
      placeholder: 'Optional',
    },
    {
      id: 'message',
      type: 'message',
      key: 'message',
      label: 'Message',
      required: false,
      placeholder: 'How can we help?',
    },
  ];
}

export function listingHiddenField(): WorkspaceFormField {
  return {
    id: 'listing_id',
    type: 'hidden',
    key: 'listing_id',
    label: 'Listing ID',
    required: false,
    helpText:
      'Filled from the embed URL (?listing=) or a data-listing attribute.',
  };
}

function slugifyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function fieldKeyForType(
  type: WorkspaceFormFieldType,
  label: string,
  existingKeys: string[],
): string {
  if (
    type === 'name' ||
    type === 'email' ||
    type === 'phone' ||
    type === 'message'
  ) {
    return type;
  }

  if (type === 'hidden' && /listing|property/.test(label.toLowerCase())) {
    return 'listing_id';
  }

  const base = slugifyKey(label) || type;
  if (!existingKeys.includes(base) && !SEMANTIC_KEYS.has(base)) {
    return base;
  }

  let index = 2;
  let candidate = `${base}_${index}`;
  while (existingKeys.includes(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  return candidate;
}

export function createWorkspaceFormField(
  type: WorkspaceFormFieldType,
  existing: WorkspaceFormField[],
): WorkspaceFormField {
  const existingKeys = existing.map((field) => field.key);
  const label = WORKSPACE_FORM_FIELD_TYPE_LABELS[type];
  const key = fieldKeyForType(type, label, existingKeys);

  return {
    id: `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    key,
    label,
    required: type === 'name' || type === 'email',
    options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
  };
}

export function ensureListingField(
  fields: WorkspaceFormField[],
): WorkspaceFormField[] {
  if (fields.some((field) => field.key === 'listing_id')) {
    return fields;
  }
  return [...fields, listingHiddenField()];
}

export type FormContactValues = {
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  message: string | null;
  companyName: string | null;
  listingId: string | null;
  extras: Record<string, string | boolean>;
};

function readString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : '';
  return '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function extractContactFromValues(
  fields: WorkspaceFormField[],
  values: Record<string, unknown>,
): FormContactValues {
  const extras: Record<string, string | boolean> = {};
  let contactName = '';
  let contactEmail = '';
  let contactPhone: string | null = null;
  let message: string | null = null;
  let companyName: string | null = null;
  let listingId: string | null = null;

  for (const field of fields) {
    const raw = values[field.key] ?? values[field.id];
    if (field.type === 'checkbox') {
      const checked =
        raw === true || raw === 'true' || raw === 'on' || raw === '1';
      extras[field.key] = checked;
      continue;
    }

    const text = readString(raw);
    if (field.type === 'name' || field.key === 'name') {
      contactName = text;
      continue;
    }
    if (field.type === 'email' || field.key === 'email') {
      contactEmail = text;
      continue;
    }
    if (field.type === 'phone' || field.key === 'phone') {
      contactPhone = text || null;
      continue;
    }
    if (field.type === 'message' || field.key === 'message') {
      message = text || null;
      continue;
    }
    if (field.key === 'company' || field.key === 'company_name') {
      companyName = text || null;
      extras[field.key] = text;
      continue;
    }
    if (field.key === 'listing_id' || field.key === 'property_id') {
      listingId = isUuid(text) ? text : null;
      continue;
    }
    if (text) {
      extras[field.key] = text;
    }
  }

  return {
    contactName,
    contactEmail,
    contactPhone,
    message,
    companyName,
    listingId,
    extras,
  };
}

export function resolveBoundListingId(input: {
  queryListingId?: string | null;
  hiddenListingId?: string | null;
  formListingId?: string | null;
}): string | null {
  const candidates = [
    input.queryListingId,
    input.hiddenListingId,
    input.formListingId,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim() ?? '';
    if (isUuid(value)) return value;
  }

  return null;
}

export function formatPipelineNotes(input: {
  contactEmail: string | null;
  contactPhone: string | null;
  message: string | null;
  extras: Record<string, string | boolean>;
}): string | null {
  const lines: string[] = [];
  if (input.contactEmail) lines.push(`Email: ${input.contactEmail}`);
  if (input.contactPhone) lines.push(`Phone: ${input.contactPhone}`);
  if (input.message) lines.push(input.message);

  const extraLines = Object.entries(input.extras)
    .filter(([key]) => key !== 'company' && key !== 'company_name')
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`);

  if (extraLines.length) {
    if (lines.length) lines.push('');
    lines.push(...extraLines);
  }

  const notes = lines.join('\n').trim();
  return notes || null;
}

export function publicVisibleFields(
  fields: WorkspaceFormField[],
): WorkspaceFormField[] {
  return fields.filter((field) => field.type !== 'hidden');
}
