export const WORKSPACE_FORM_UPLOAD_BUCKET = 'workspace-form-uploads';

export const WORKSPACE_FORM_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const WORKSPACE_FORM_UPLOAD_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf';

export const WORKSPACE_FORM_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
] as const;

const ALLOWED_MIME = new Set<string>(WORKSPACE_FORM_UPLOAD_MIME_TYPES);

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
};

export type WorkspaceFormFileValue = {
  name: string;
  url: string;
  path: string;
  mimeType: string;
  size: number;
};

export type PublicFormValue = string | boolean | WorkspaceFormFileValue;

export type PublicFormValues = Record<string, PublicFormValue>;

export function fileExtension(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

export function mimeFromFileName(name: string): string | null {
  return EXT_TO_MIME[fileExtension(name)] ?? null;
}

export function resolveUploadMimeType(input: {
  mimeType?: string | null;
  fileName: string;
}): string | null {
  const mime = input.mimeType?.trim().toLowerCase() ?? '';
  if (ALLOWED_MIME.has(mime)) return mime;
  return mimeFromFileName(input.fileName);
}

export function isAllowedFormUpload(input: {
  mimeType?: string | null;
  fileName: string;
  size: number;
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (input.size <= 0) {
    return { ok: false, error: 'Please choose a file.' };
  }
  if (input.size > WORKSPACE_FORM_UPLOAD_MAX_BYTES) {
    return { ok: false, error: 'File is too large. Max size is 10MB.' };
  }
  const mimeType = resolveUploadMimeType(input);
  if (!mimeType) {
    return {
      ok: false,
      error:
        'Use a PDF, image, or common document (Word, Excel, PowerPoint, text).',
    };
  }
  return { ok: true, mimeType };
}

export function isWorkspaceFormFileValue(
  value: unknown,
): value is WorkspaceFormFileValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === 'string' &&
    typeof row.url === 'string' &&
    typeof row.path === 'string' &&
    typeof row.mimeType === 'string' &&
    typeof row.size === 'number'
  );
}

export function parseFormFileValue(
  raw: unknown,
): WorkspaceFormFileValue | null {
  if (isWorkspaceFormFileValue(raw)) {
    return sanitizeFormFileValue(raw);
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isWorkspaceFormFileValue(parsed)) return null;
    return sanitizeFormFileValue(parsed);
  } catch {
    return null;
  }
}

function sanitizeFormFileValue(
  value: WorkspaceFormFileValue,
): WorkspaceFormFileValue | null {
  const name = value.name.trim().slice(0, 240);
  const url = value.url.trim().slice(0, 2000);
  const path = value.path.trim().slice(0, 500);
  const mimeType = value.mimeType.trim().slice(0, 120);
  const size = value.size;
  if (!name || !url || !path || !mimeType) return null;
  if (
    !Number.isFinite(size) ||
    size <= 0 ||
    size > WORKSPACE_FORM_UPLOAD_MAX_BYTES
  ) {
    return null;
  }
  if (path.includes('..') || path.startsWith('/')) return null;
  if (!isFormUploadUrlForPath(url, path)) return null;
  return { name, url, path, mimeType, size };
}

export function isFormUploadPathForForm(
  path: string,
  accountId: string,
  formId: string,
): boolean {
  const prefix = `${accountId}/${formId}/`;
  return path.startsWith(prefix) && !path.includes('..');
}

export function formUploadPublicPath(path: string): string {
  return `/storage/v1/object/public/${WORKSPACE_FORM_UPLOAD_BUCKET}/${path}`;
}

export function isFormUploadUrlForPath(url: string, path: string): boolean {
  if (!path || path.includes('..') || path.startsWith('/')) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const pathname = decodeURIComponent(parsed.pathname);
    if (pathname !== formUploadPublicPath(path)) return false;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (supabaseUrl && process.env.NODE_ENV !== 'test') {
      return parsed.origin === new URL(supabaseUrl).origin;
    }
    return true;
  } catch {
    return false;
  }
}

export function formatFormFileValue(
  value: WorkspaceFormFileValue,
  options?: { includeUrl?: boolean },
): string {
  if (options?.includeUrl === false) return value.name;
  return `${value.name} (${value.url})`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
