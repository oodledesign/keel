import { afterEach, describe, expect, it, vi } from 'vitest';

const SIGNED_URL =
  'https://example.supabase.co/storage/v1/object/sign/ig-automation-assets/a/delivery/b.m4a?token=secret-token';

const uploadMessageAttachment = vi.fn(async () => 'attachment-123');

vi.mock('../graph-api', async () => {
  const actual =
    await vi.importActual<typeof import('../graph-api')>('../graph-api');
  return { ...actual, uploadMessageAttachment };
});

const { getOrCreateMetaAttachmentId } = await import('./get-delivery-url');
const { IgGraphApiError } = await import('../graph-api');

function makeAdmin() {
  const updates: unknown[] = [];
  const admin = {
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: SIGNED_URL },
          error: null,
        }),
      }),
    },
    from: () => ({
      update: (patch: unknown) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
  return { admin, updates };
}

const asset = {
  id: 'asset-1',
  account_id: 'acc-1',
  kind: 'audio' as const,
  delivery_path: 'acc-1/delivery/asset-1.m4a',
  transcode_status: 'ready',
  meta_attachment_ids: {},
};

afterEach(() => {
  vi.restoreAllMocks();
  uploadMessageAttachment.mockClear();
});

describe('getOrCreateMetaAttachmentId', () => {
  it('caches only the attachment id, never the signed URL, and does not log it', async () => {
    const logSpies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    const { admin, updates } = makeAdmin();

    const id = await getOrCreateMetaAttachmentId({
      admin: admin as never,
      asset,
      igAccountId: 'ig-1',
      igBusinessAccountId: '1784',
      accessToken: 'token',
    });

    expect(id).toBe('attachment-123');
    expect(uploadMessageAttachment).toHaveBeenCalledWith('1784', 'token', {
      type: 'audio',
      url: SIGNED_URL,
    });
    expect(JSON.stringify(updates)).not.toContain('https://');
    expect(updates).toEqual([
      { meta_attachment_ids: { 'ig-1': 'attachment-123' } },
    ]);

    for (const spy of logSpies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(SIGNED_URL);
      }
    }
  });

  it('reuses a cached attachment id without creating a signed URL', async () => {
    const { admin } = makeAdmin();
    const id = await getOrCreateMetaAttachmentId({
      admin: admin as never,
      asset: { ...asset, meta_attachment_ids: { 'ig-1': 'cached-id' } },
      igAccountId: 'ig-1',
      igBusinessAccountId: '1784',
      accessToken: 'token',
    });
    expect(id).toBe('cached-id');
    expect(uploadMessageAttachment).not.toHaveBeenCalled();
  });

  it('refuses assets that are not ready', async () => {
    const { admin } = makeAdmin();
    await expect(
      getOrCreateMetaAttachmentId({
        admin: admin as never,
        asset: { ...asset, transcode_status: 'processing' },
        igAccountId: 'ig-1',
        igBusinessAccountId: '1784',
        accessToken: 'token',
      }),
    ).rejects.toThrow('not ready');
  });
});

describe('IgGraphApiError', () => {
  it('redacts URLs from Meta error messages', () => {
    const error = new IgGraphApiError(`Failed to fetch ${SIGNED_URL}`, 100);
    expect(error.message).not.toContain('secret-token');
    expect(error.message).toContain('[url]');
  });
});
