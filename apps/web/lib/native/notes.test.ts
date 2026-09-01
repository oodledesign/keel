import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeHttpError } from './http';
import { createNativeNote } from './notes';
import type { NativeWorkspace } from './workspace-shared';

const createRecorderNote = vi.fn();

vi.mock('~/lib/recorder/create-note', () => ({
  createRecorderNote: (...args: unknown[]) => createRecorderNote(...args),
  listRecorderNotes: vi.fn(),
}));

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'oodle',
  name: 'Oodle',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('createNativeNote', () => {
  beforeEach(() => {
    createRecorderNote.mockReset();
    createRecorderNote.mockResolvedValue({
      id: 'n1',
      title: 'Site visit',
      content: 'Me: Hello',
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
      detail_path: '/notes/n1',
    });
  });

  it('passes optional client_id when it belongs to the workspace', async () => {
    const clientLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: clientId },
        error: null,
      }),
    };

    const created = await createNativeNote({
      userId: 'user-dan',
      workspace: studio,
      body: 'Me: Hello',
      title: 'Site visit',
      category: 'meeting_transcript',
      clientId,
      client: { from: () => clientLookup } as never,
    });

    expect(createRecorderNote).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId,
        category: 'meeting_transcript',
        accountId: studio.id,
      }),
    );
    expect(created.client_id).toBe(clientId);
    expect(created.category).toBe('meeting_transcript');
  });

  it('rejects a client from another workspace', async () => {
    const clientLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    await expect(
      createNativeNote({
        userId: 'user-dan',
        workspace: studio,
        body: 'Me: Hello',
        clientId,
        client: { from: () => clientLookup } as never,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'client_id must belong to this workspace',
    } satisfies Partial<NativeHttpError>);
    expect(createRecorderNote).not.toHaveBeenCalled();
  });
});
