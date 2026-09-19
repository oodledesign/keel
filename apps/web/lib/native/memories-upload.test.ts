import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeHttpError } from './http';
import { parseNativeMemoryFormFile } from './memories';
import type { NativeWorkspace } from './workspace-shared';

const upload = vi.fn();
const remove = vi.fn();
const createSignedUrl = vi.fn();
const createSignedUploadUrl = vi.fn();

vi.mock('~/lib/brain/sync', () => ({
  queueBrainIndexSource: vi.fn(),
}));

vi.mock('@kit/supabase/server-admin-client', () => ({
  getSupabaseServerAdminClient: () => ({
    storage: {
      from: () => ({
        upload,
        remove,
        createSignedUrl,
        createSignedUploadUrl,
      }),
    },
  }),
}));

const family: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'the-house',
  name: 'The House',
  profile: 'family',
  isPersonal: false,
  image: null,
};

describe('parseNativeMemoryFormFile', () => {
  it('accepts a jpeg and rejects a pdf', () => {
    const photo = new File([new Uint8Array(32)], 'poet.jpg', {
      type: 'image/jpeg',
    });
    expect(parseNativeMemoryFormFile(photo)).toMatchObject({
      filename: 'poet.jpg',
      mimeType: 'image/jpeg',
    });

    const pdf = new File([new Uint8Array(32)], 'report.pdf', {
      type: 'application/pdf',
    });
    expect(() => parseNativeMemoryFormFile(pdf)).toThrow(NativeHttpError);
  });

  it('accepts voice notes from a filename when mime is empty', () => {
    const audio = new File([new Uint8Array(64)], 'voice.caf', { type: '' });
    expect(parseNativeMemoryFormFile(audio).mimeType).toBe('audio/x-caf');
  });
});

describe('uploadNativeMemoryMedia', () => {
  beforeEach(() => {
    upload.mockReset();
    remove.mockReset();
    createSignedUrl.mockReset();
    createSignedUploadUrl.mockReset();
  });

  it('uploads through admin storage and links the doc to the memory', async () => {
    const { uploadNativeMemoryMedia } = await import('./memories');
    upload.mockResolvedValue({ error: null });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://files.example/memory.jpg' },
    });

    const from = vi.fn((table: string) => {
      if (table === 'notes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'note-1', category: 'memory' },
            error: null,
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'doc-1', title: 'poet.jpg', mime_type: 'image/jpeg' },
          error: null,
        }),
      };
    });

    const result = await uploadNativeMemoryMedia({
      client: { from } as never,
      userId: 'user-1',
      workspace: family,
      noteId: 'note-1',
      bytes: Buffer.from('photo'),
      filename: 'poet.jpg',
      mimeType: 'image/jpeg',
    });

    expect(upload).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith('docs');
    expect(result).toMatchObject({
      id: 'doc-1',
      mime_type: 'image/jpeg',
      kind: 'image',
      url: 'https://files.example/memory.jpg',
    });
  });

  it('rejects a missing memory note', async () => {
    const { uploadNativeMemoryMedia } = await import('./memories');
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    await expect(
      uploadNativeMemoryMedia({
        client: { from } as never,
        userId: 'user-1',
        workspace: family,
        noteId: 'note-missing',
        bytes: Buffer.from('photo'),
        filename: 'poet.jpg',
        mimeType: 'image/jpeg',
      }),
    ).rejects.toBeInstanceOf(NativeHttpError);
    expect(upload).not.toHaveBeenCalled();
  });
});
