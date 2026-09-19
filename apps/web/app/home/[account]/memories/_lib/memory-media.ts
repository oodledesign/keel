export const MEMORY_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
export const MEMORY_MEDIA_MAX_LABEL = '50 MB';

export const MEMORY_NOTE_MEDIA_TAG = 'memory';

export const MEMORY_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const;

export const MEMORY_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export const MEMORY_AUDIO_MIME_TYPES = [
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'audio/aac',
  'audio/caf',
  'audio/x-caf',
  'audio/ogg',
] as const;

export type MemoryMediaKind = 'image' | 'video' | 'audio';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
]);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);
const AUDIO_EXTENSIONS = new Set([
  'm4a',
  'caf',
  'mp3',
  'wav',
  'aac',
  'ogg',
  'webm',
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  webm: 'video/webm',
  m4a: 'audio/mp4',
  caf: 'audio/x-caf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
};

export class MemoryMediaError extends Error {
  readonly code: 'type' | 'size';

  constructor(code: 'type' | 'size', message: string) {
    super(message);
    this.name = 'MemoryMediaError';
    this.code = code;
  }
}

export function fileExtension(filename: string) {
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return '';
  return trimmed.slice(dot + 1).toLowerCase();
}

export function inferMimeFromFilename(filename: string) {
  const ext = fileExtension(filename);
  if (!ext) return null;
  if (ext === 'webm') return 'video/webm';
  return EXT_TO_MIME[ext] ?? null;
}

export function normalizeMemoryMimeType(
  mimeType: string | null | undefined,
  filename = '',
) {
  const explicit = mimeType?.trim().toLowerCase() ?? '';
  if (explicit && explicit !== 'application/octet-stream') {
    return explicit;
  }

  return inferMimeFromFilename(filename) ?? explicit;
}

export function classifyMemoryMedia(
  mimeType: string | null | undefined,
  filename = '',
): MemoryMediaKind | null {
  const mime = normalizeMemoryMimeType(mimeType, filename);
  const ext = fileExtension(filename);

  if (
    mime.startsWith('image/') ||
    MEMORY_IMAGE_MIME_TYPES.includes(
      mime as (typeof MEMORY_IMAGE_MIME_TYPES)[number],
    ) ||
    IMAGE_EXTENSIONS.has(ext)
  ) {
    return 'image';
  }

  if (
    mime.startsWith('video/') ||
    MEMORY_VIDEO_MIME_TYPES.includes(
      mime as (typeof MEMORY_VIDEO_MIME_TYPES)[number],
    ) ||
    VIDEO_EXTENSIONS.has(ext)
  ) {
    return 'video';
  }

  if (
    mime.startsWith('audio/') ||
    MEMORY_AUDIO_MIME_TYPES.includes(
      mime as (typeof MEMORY_AUDIO_MIME_TYPES)[number],
    ) ||
    AUDIO_EXTENSIONS.has(ext)
  ) {
    return 'audio';
  }

  return null;
}

export function memoryMediaTooLargeMessage() {
  return `This file is over ${MEMORY_MEDIA_MAX_LABEL}. Memories accept photos, video, and audio up to ${MEMORY_MEDIA_MAX_LABEL} — the same limit as other workspace documents.`;
}

export function memoryMediaTypeMessage() {
  return 'Attach a photo, video (mp4/mov), or voice note (m4a, caf, mp3, wav).';
}

export function assertMemoryMedia(input: {
  mimeType?: string | null;
  filename?: string;
  size: number;
}): MemoryMediaKind {
  if (!Number.isFinite(input.size) || input.size < 0) {
    throw new MemoryMediaError('size', memoryMediaTooLargeMessage());
  }

  if (input.size > MEMORY_MEDIA_MAX_BYTES) {
    throw new MemoryMediaError('size', memoryMediaTooLargeMessage());
  }

  const kind = classifyMemoryMedia(input.mimeType, input.filename ?? '');
  if (!kind) {
    throw new MemoryMediaError('type', memoryMediaTypeMessage());
  }

  return kind;
}

export function safeMemoryFilename(filename: string, fallback = 'memory.bin') {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned.replace(/^\.+/, '') || fallback;
}

export function memoryMediaStoragePath(accountId: string, filename: string) {
  const safe = safeMemoryFilename(filename, 'memory.bin');
  return `${accountId}/memories/${Date.now()}_${safe}`;
}

export function memoryMediaTags(kind: MemoryMediaKind) {
  if (kind === 'audio') return [MEMORY_NOTE_MEDIA_TAG, 'memory_audio'];
  if (kind === 'video') return [MEMORY_NOTE_MEDIA_TAG, 'memory_video'];
  return [MEMORY_NOTE_MEDIA_TAG];
}

export function isFormBlob(value: FormDataEntryValue | null): value is Blob {
  return (
    Boolean(value) &&
    typeof value !== 'string' &&
    typeof (value as Blob).arrayBuffer === 'function'
  );
}

export function formFileMeta(value: Blob) {
  const named = value as Blob & { name?: string; type?: string };
  const filename =
    typeof named.name === 'string' && named.name.trim()
      ? named.name
      : 'memory.bin';
  const mimeType = normalizeMemoryMimeType(named.type, filename);

  return { filename, mimeType, size: value.size };
}

export function getUnknownErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}
