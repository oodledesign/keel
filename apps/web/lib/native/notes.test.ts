import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeHttpError } from './http';
import {
  createNativeNote,
  listNativeNoteCategories,
  updateNativeNote,
} from './notes';
import { NATIVE_MEETING_NOTE_CATEGORY } from './notes-shared';
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

  it('accepts a custom category that belongs to the workspace', async () => {
    const categories = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ slug: 'research', label: 'Research' }],
        error: null,
      }),
    };

    await createNativeNote({
      userId: 'user-dan',
      workspace: studio,
      body: 'Look this up',
      category: 'research',
      client: { from: () => categories } as never,
    });

    expect(createRecorderNote).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'research',
        accountId: studio.id,
      }),
    );
  });

  it('rejects a category that is not system or custom for the workspace', async () => {
    const categories = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    await expect(
      createNativeNote({
        userId: 'user-dan',
        workspace: studio,
        body: 'Me: Hello',
        category: 'invented_kind',
        client: { from: () => categories } as never,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Unknown note category',
    } satisfies Partial<NativeHttpError>);
    expect(createRecorderNote).not.toHaveBeenCalled();
  });
});

describe('listNativeNoteCategories', () => {
  it('returns system categories plus custom workspace slugs', async () => {
    const categories = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ slug: 'research', label: 'Research' }],
        error: null,
      }),
    };

    const items = await listNativeNoteCategories(
      { from: () => categories } as never,
      studio,
    );

    expect(items[0]).toEqual({
      slug: 'idea',
      label: 'Idea',
      is_custom: false,
    });
    expect(items.some((item) => item.slug === NATIVE_MEETING_NOTE_CATEGORY)).toBe(
      true,
    );
    expect(items.at(-1)).toEqual({
      slug: 'research',
      label: 'Research',
      is_custom: true,
    });
  });
});

describe('updateNativeNote', () => {
  const noteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function noteRow(overrides: Record<string, unknown> = {}) {
    return {
      id: noteId,
      title: 'Site visit',
      content: 'Me: Hello',
      account_id: studio.id,
      created_by: 'user-dan',
      category: 'idea',
      tags: [],
      client_id: null,
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T11:00:00Z',
      ...overrides,
    };
  }

  it('updates title, body, category, and client', async () => {
    const existing = noteRow();
    const updated = noteRow({
      title: 'Roof notes',
      content: 'Scaffold is up',
      category: 'development',
      client_id: clientId,
    });

    const notes = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: existing, error: null })
        .mockResolvedValueOnce({ data: updated, error: null }),
    };
    const clients = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: clientId },
        error: null,
      }),
    };
    const accounts = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { slug: studio.slug },
        error: null,
      }),
    };

    const note = await updateNativeNote({
      client: {
        from: (table: string) => {
          if (table === 'notes') return notes;
          if (table === 'clients') return clients;
          if (table === 'accounts') return accounts;
          throw new Error(`unexpected table ${table}`);
        },
      } as never,
      userId: 'user-dan',
      noteId,
      title: 'Roof notes',
      body: 'Scaffold is up',
      category: 'development',
      clientId,
    });

    expect(notes.update).toHaveBeenCalledWith({
      title: 'Roof notes',
      content: 'Scaffold is up',
      category: 'development',
      client_id: clientId,
    });
    expect(note).toMatchObject({
      id: noteId,
      title: 'Roof notes',
      body: 'Scaffold is up',
      category: 'development',
      client_id: clientId,
      workspace: studio.slug,
    });
  });

  it('clears client_id when null is sent', async () => {
    const existing = noteRow({ client_id: clientId });
    const updated = noteRow({ client_id: null });
    const notes = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: existing, error: null })
        .mockResolvedValueOnce({ data: updated, error: null }),
    };
    const accounts = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { slug: studio.slug },
        error: null,
      }),
    };

    const note = await updateNativeNote({
      client: {
        from: (table: string) => {
          if (table === 'notes') return notes;
          if (table === 'accounts') return accounts;
          throw new Error(`unexpected table ${table}`);
        },
      } as never,
      userId: 'user-dan',
      noteId,
      clientId: null,
    });

    expect(notes.update).toHaveBeenCalledWith({ client_id: null });
    expect(note.client_id).toBeNull();
  });

  it('rejects an invented category', async () => {
    const notes = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: noteRow(),
        error: null,
      }),
    };
    const categories = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    await expect(
      updateNativeNote({
        client: {
          from: (table: string) => {
            if (table === 'notes') return notes;
            if (table === 'note_categories') return categories;
            throw new Error(`unexpected table ${table}`);
          },
        } as never,
        userId: 'user-dan',
        noteId,
        category: 'invented_kind',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Unknown note category',
    } satisfies Partial<NativeHttpError>);
  });
});
