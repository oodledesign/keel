export const PROJECT_FIELD_TYPES = [
  'text',
  'checkbox',
  'url',
  'client_link',
  'project_link',
  'select',
  'currency',
  'date',
  'number',
  'email',
] as const;

export type ProjectFieldType = (typeof PROJECT_FIELD_TYPES)[number];

export type ProjectFieldDefinition = {
  id: string;
  accountId: string;
  projectId: string;
  fieldKey: string;
  label: string;
  fieldType: ProjectFieldType;
  options: { choices?: string[] };
  sortOrder: number;
};

export type ProjectFieldValue = string | number | boolean | null;

export type ProjectClientRow = {
  clientId: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  websiteUrl: string | null;
  values: Record<string, ProjectFieldValue>;
};

export type CampaignProject = {
  id: string;
  accountId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  clientCount: number;
};

export type CampaignProjectDetail = CampaignProject & {
  fields: ProjectFieldDefinition[];
  rows: ProjectClientRow[];
};

export const PROJECT_FIELD_TYPE_LABELS: Record<ProjectFieldType, string> = {
  text: 'Text',
  checkbox: 'Checkbox',
  url: 'URL',
  client_link: 'Client link',
  project_link: 'Project link',
  select: 'Select',
  currency: 'Currency',
  date: 'Date',
  number: 'Number',
  email: 'Email',
};

export function slugifyFieldKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9]/, 'f_$&');
  return base || 'field';
}

export function normalizeFieldValue(
  fieldType: ProjectFieldType,
  raw: unknown,
): ProjectFieldValue {
  if (raw === null || raw === undefined || raw === '') return null;

  switch (fieldType) {
    case 'checkbox':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      return null;
    case 'currency':
    case 'number':
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw === 'string') {
        const parsed = Number(raw.replace(/[£$,]/g, '').trim());
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    case 'client_link':
    case 'project_link':
      return typeof raw === 'string' && raw.length > 0 ? raw : null;
    default:
      return typeof raw === 'string' ? raw : String(raw);
  }
}
