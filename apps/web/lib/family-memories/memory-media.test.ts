import { describe, expect, it } from 'vitest';

import {
  MEMORY_MEDIA_MAX_BYTES,
  MemoryMediaError,
  assertMemoryMedia,
  classifyMemoryMedia,
  formFileMeta,
  getUnknownErrorMessage,
  isFormBlob,
  memoryMediaStoragePath,
  memoryMediaTags,
  memoryObjectIsListed,
  normalizeMemoryMimeType,
  splitMemoryStoragePath,
} from '~/home/[account]/memories/_lib/memory-media';

describe('classifyMemoryMedia', () => {
  it('classifies by mime and filename', () => {
    expect(classifyMemoryMedia('image/jpeg', 'photo.jpg')).toBe('image');
    expect(classifyMemoryMedia('video/mp4', 'clip.mp4')).toBe('video');
    expect(classifyMemoryMedia('video/quicktime', 'clip.mov')).toBe('video');
    expect(classifyMemoryMedia('audio/mp4', 'note.m4a')).toBe('audio');
    expect(classifyMemoryMedia('', 'voice.caf')).toBe('audio');
    expect(classifyMemoryMedia('application/pdf', 'doc.pdf')).toBeNull();
  });
});

describe('assertMemoryMedia', () => {
  it('accepts a photo under the document limit', () => {
    expect(
      assertMemoryMedia({
        mimeType: 'image/jpeg',
        filename: 'poet.jpg',
        size: 1_000_000,
      }),
    ).toBe('image');
  });

  it('rejects oversized and unknown files with clear errors', () => {
    expect(() =>
      assertMemoryMedia({
        mimeType: 'image/jpeg',
        filename: 'huge.jpg',
        size: MEMORY_MEDIA_MAX_BYTES + 1,
      }),
    ).toThrow(MemoryMediaError);

    try {
      assertMemoryMedia({
        mimeType: 'application/pdf',
        filename: 'report.pdf',
        size: 100,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(MemoryMediaError);
      expect((error as MemoryMediaError).code).toBe('type');
    }
  });
});

describe('memory media helpers', () => {
  it('normalizes empty mime from filename and builds a storage path', () => {
    expect(normalizeMemoryMimeType('', 'clip.mov')).toBe('video/quicktime');
    expect(
      memoryMediaStoragePath(
        '11111111-1111-4111-8111-111111111111',
        'Poet moon!.jpg',
      ),
    ).toMatch(
      /^11111111-1111-4111-8111-111111111111\/memories\/\d+_Poet_moon_.jpg$/,
    );
    expect(memoryMediaTags('audio')).toEqual(['memory', 'memory_audio']);
  });

  it('reads form blobs without requiring File instanceof', () => {
    const blob = new Blob(['hello'], { type: 'audio/mp4' });
    (blob as Blob & { name?: string }).name = 'note.m4a';
    expect(isFormBlob(blob)).toBe(true);
    expect(isFormBlob('workspace')).toBe(false);
    expect(isFormBlob(null)).toBe(false);
    expect(formFileMeta(blob)).toMatchObject({
      filename: 'note.m4a',
      mimeType: 'audio/mp4',
    });
    expect(
      getUnknownErrorMessage({ message: 'new row violates rls' }, 'fallback'),
    ).toBe('new row violates rls');
  });

  it('proves a storage object from list results, not a signed URL', () => {
    expect(
      splitMemoryStoragePath(
        '11111111-1111-4111-8111-111111111111/memories/1_poet.jpg',
      ),
    ).toEqual({
      folder: '11111111-1111-4111-8111-111111111111/memories',
      objectName: '1_poet.jpg',
    });
    expect(splitMemoryStoragePath('poet.jpg')).toBeNull();
    expect(
      memoryObjectIsListed(
        [{ name: '1_poet.jpg' }, { name: 'other.jpg' }],
        '1_poet.jpg',
      ),
    ).toBe(true);
    expect(memoryObjectIsListed([{ name: 'other.jpg' }], '1_poet.jpg')).toBe(
      false,
    );
  });
});
