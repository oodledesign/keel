import { describe, expect, it } from 'vitest';

import {
  IG_ASSET_MAX_BYTES,
  detectFormat,
  isAudioTooLong,
  parseFfmpegDurationMs,
  validateAssetUpload,
} from './detect-format';

function bytes(...values: Array<number | string>): Uint8Array {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === 'string') {
      for (const ch of v) out.push(ch.charCodeAt(0));
    } else {
      out.push(v);
    }
  }
  while (out.length < 16) out.push(0);
  return Uint8Array.from(out);
}

describe('detectFormat', () => {
  it('detects MediaRecorder webm', () => {
    expect(detectFormat(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe('webm');
  });

  it('detects ogg', () => {
    expect(detectFormat(bytes('OggS'))).toBe('ogg');
  });

  it('detects wav', () => {
    expect(detectFormat(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBe('wav');
  });

  it('detects mp4 / m4a by ftyp box', () => {
    expect(detectFormat(bytes(0, 0, 0, 0x20, 'ftypM4A '))).toBe('mp4');
    expect(detectFormat(bytes(0, 0, 0, 0x20, 'ftypisom'))).toBe('mp4');
  });

  it('detects quicktime', () => {
    expect(detectFormat(bytes(0, 0, 0, 0x14, 'ftypqt  '))).toBe('mov');
  });

  it('detects ADTS aac and mp3', () => {
    expect(detectFormat(bytes(0xff, 0xf1))).toBe('aac');
    expect(detectFormat(bytes('ID3'))).toBe('mp3');
    expect(detectFormat(bytes(0xff, 0xfb))).toBe('mp3');
  });

  it('detects images and pdf', () => {
    expect(detectFormat(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('png');
    expect(detectFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(detectFormat(bytes('%PDF-1.7'))).toBe('pdf');
  });

  it('returns null for unknown or tiny input', () => {
    expect(detectFormat(bytes('hello world'))).toBeNull();
    expect(detectFormat(Uint8Array.from([1, 2]))).toBeNull();
  });
});

describe('validateAssetUpload', () => {
  it('accepts browser webm for audio', () => {
    const result = validateAssetUpload({
      kind: 'audio',
      sizeBytes: 1000,
      head: bytes(0x1a, 0x45, 0xdf, 0xa3),
    });
    expect(result).toEqual({ ok: true, format: 'webm' });
  });

  it('rejects files over 25 MB', () => {
    const result = validateAssetUpload({
      kind: 'audio',
      sizeBytes: IG_ASSET_MAX_BYTES.audio + 1,
      head: bytes(0, 0, 0, 0x20, 'ftypM4A '),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects images over 8 MB', () => {
    const result = validateAssetUpload({
      kind: 'image',
      sizeBytes: 9 * 1024 * 1024,
      head: bytes(0x89, 0x50, 0x4e, 0x47),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a format that does not match the kind', () => {
    const result = validateAssetUpload({
      kind: 'audio',
      sizeBytes: 1000,
      head: bytes('%PDF'),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects empty files', () => {
    const result = validateAssetUpload({
      kind: 'pdf',
      sizeBytes: 0,
      head: bytes('%PDF'),
    });
    expect(result.ok).toBe(false);
  });
});

describe('duration helpers', () => {
  it('parses ffmpeg duration output', () => {
    expect(
      parseFfmpegDurationMs('  Duration: 00:00:12.34, start: 0.000000'),
    ).toBe(12340);
    expect(parseFfmpegDurationMs('Duration: 01:02:03.5')).toBe(3723500);
    expect(parseFfmpegDurationMs('Duration: N/A')).toBeNull();
  });

  it('flags audio over 60 seconds', () => {
    expect(isAudioTooLong(60_000)).toBe(false);
    expect(isAudioTooLong(60_500)).toBe(false);
    expect(isAudioTooLong(62_000)).toBe(true);
  });
});
