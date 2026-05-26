import type { NoteContextLink } from './types';

type RawNoteRow = {
  project_id?: string | null;
  job_id?: string | null;
  client_org_id?: string | null;
  client_id?: string | null;
  property_id?: string | null;
  task_id?: string | null;
  projects?: { name?: string | null } | null;
  jobs?: { title?: string | null } | null;
  client_orgs?: { name?: string | null } | null;
  clients?: { display_name?: string | null } | null;
  properties?: { name?: string | null } | null;
  tasks?: { title?: string | null } | null;
};

export function displayTitle(title: string, content: string): string {
  const t = title.trim();
  if (t) return t;
  const first = content.replace(/\s+/g, ' ').trim().split('\n')[0] ?? '';
  return first.slice(0, 80) || 'Untitled';
}

export function previewContent(content: string, max = 100): string {
  const plain = content.replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}…`;
}

export function docContentPreview(content: string | null, max = 100): string {
  return previewContent(content ?? '', max);
}

export function resolveNoteContext(row: RawNoteRow): NoteContextLink | null {
  if (row.property_id && row.properties?.name) {
    return {
      type: 'property',
      id: row.property_id,
      label: row.properties.name.trim(),
    };
  }
  if (row.project_id && row.projects?.name) {
    return {
      type: 'project',
      id: row.project_id,
      label: row.projects.name.trim(),
    };
  }
  if (row.job_id && row.jobs?.title) {
    return {
      type: 'job',
      id: row.job_id,
      label: row.jobs.title.trim(),
    };
  }
  const clientName =
    row.client_orgs?.name?.trim() || row.clients?.display_name?.trim();
  const clientId = row.client_org_id ?? row.client_id;
  if (clientId && clientName) {
    return { type: 'client', id: clientId, label: clientName };
  }
  if (row.task_id && row.tasks?.title) {
    return {
      type: 'task',
      id: row.task_id,
      label: row.tasks.title.trim(),
    };
  }
  return null;
}

export function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
  }
  return [];
}
