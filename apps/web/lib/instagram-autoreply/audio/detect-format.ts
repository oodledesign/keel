export type IgAssetKind = 'audio' | 'image' | 'video' | 'pdf';

export type DetectedFormat =
  | 'webm'
  | 'ogg'
  | 'mp4'
  | 'mov'
  | 'wav'
  | 'aac'
  | 'mp3'
  | 'png'
  | 'jpeg'
  | 'pdf';

/** Meta: audio/video/pdf ≤ 25 MB, images ≤ 8 MB. */
export const IG_ASSET_MAX_BYTES: Record<IgAssetKind, number> = {
  audio: 25 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  pdf: 25 * 1024 * 1024,
  image: 8 * 1024 * 1024,
};

export const IG_AUDIO_MAX_DURATION_MS = 60_000;

/** Small tolerance for encoder padding on a 60s recording. */
export const IG_AUDIO_DURATION_TOLERANCE_MS = 750;

const ACCEPTED_FORMATS: Record<IgAssetKind, DetectedFormat[]> = {
  audio: ['webm', 'ogg', 'mp4', 'wav', 'aac', 'mp3'],
  video: ['mp4', 'mov', 'webm'],
  image: ['png', 'jpeg'],
  pdf: ['pdf'],
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = start; i < start + length && i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}

/** Sniff the container from magic bytes; never trusts the client MIME type. */
export function detectFormat(bytes: Uint8Array): DetectedFormat | null {
  if (bytes.length < 4) return null;

  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return 'webm';
  }
  if (ascii(bytes, 0, 4) === 'OggS') return 'ogg';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') {
    return 'wav';
  }
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    return brand === 'qt  ' ? 'mov' : 'mp4';
  }
  if (ascii(bytes, 0, 4) === '%PDF') return 'pdf';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (ascii(bytes, 0, 3) === 'ID3') return 'mp3';
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xf6) === 0xf0) return 'aac';
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) return 'mp3';

  return null;
}

export const FORMAT_MIME: Record<DetectedFormat, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp4: 'audio/mp4',
  mov: 'video/quicktime',
  wav: 'audio/wav',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  png: 'image/png',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
};

export const FORMAT_EXTENSION: Record<DetectedFormat, string> = {
  webm: 'webm',
  ogg: 'ogg',
  mp4: 'mp4',
  mov: 'mov',
  wav: 'wav',
  aac: 'aac',
  mp3: 'mp3',
  png: 'png',
  jpeg: 'jpg',
  pdf: 'pdf',
};

export function mimeForKind(kind: IgAssetKind, format: DetectedFormat) {
  if (kind === 'video') {
    if (format === 'webm') return 'video/webm';
    if (format === 'mov') return 'video/quicktime';
    return 'video/mp4';
  }
  return FORMAT_MIME[format];
}

export type UploadValidation =
  | { ok: true; format: DetectedFormat }
  | { ok: false; error: string };

export function validateAssetUpload(params: {
  kind: IgAssetKind;
  sizeBytes: number;
  head: Uint8Array;
}): UploadValidation {
  const max = IG_ASSET_MAX_BYTES[params.kind];
  if (params.sizeBytes <= 0) {
    return { ok: false, error: 'The file is empty.' };
  }
  if (params.sizeBytes > max) {
    return {
      ok: false,
      error: `The file is too large. The maximum is ${Math.round(max / (1024 * 1024))} MB.`,
    };
  }

  const format = detectFormat(params.head);
  if (!format || !ACCEPTED_FORMATS[params.kind].includes(format)) {
    return {
      ok: false,
      error: `Unsupported ${params.kind} format. Use ${ACCEPTED_FORMATS[params.kind].join(', ')}.`,
    };
  }

  return { ok: true, format };
}

/** Parse `Duration: HH:MM:SS.xx` from ffmpeg stderr. */
export function parseFfmpegDurationMs(stderr: string): number | null {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export function isAudioTooLong(durationMs: number): boolean {
  return durationMs > IG_AUDIO_MAX_DURATION_MS + IG_AUDIO_DURATION_TOLERANCE_MS;
}
