import { describe, expect, it, vi } from 'vitest';

import {
  type IgAssetPatch,
  type ProcessAssetDeps,
  processIgAssetUpload,
} from './process-asset-upload';

function makeDeps(overrides: Partial<ProcessAssetDeps> = {}) {
  const patches: IgAssetPatch[] = [];
  const uploads: Array<{ path: string; contentType: string }> = [];
  const deps: ProcessAssetDeps = {
    upload: vi.fn(async (path: string, _bytes: Buffer, contentType: string) => {
      uploads.push({ path, contentType });
    }),
    updateAsset: vi.fn(async (patch: IgAssetPatch) => {
      patches.push(patch);
    }),
    transcode: vi.fn(async () => ({
      output: Buffer.from('m4a-bytes'),
      durationMs: 12_000,
    })),
    ...overrides,
  };
  return { deps, patches, uploads };
}

const base = {
  accountId: '11111111-1111-1111-1111-111111111111',
  assetId: '22222222-2222-2222-2222-222222222222',
  bytes: Buffer.from('original'),
};

describe('processIgAssetUpload', () => {
  it('transcodes audio to an m4a delivery copy and marks ready', async () => {
    const { deps, patches, uploads } = makeDeps();
    const result = await processIgAssetUpload(deps, {
      ...base,
      kind: 'audio',
      format: 'webm',
    });

    expect(result).toEqual({
      status: 'ready',
      durationMs: 12_000,
      deliveryPath: `${base.accountId}/delivery/${base.assetId}.m4a`,
    });
    expect(uploads).toEqual([
      {
        path: `${base.accountId}/originals/${base.assetId}.webm`,
        contentType: 'audio/webm',
      },
      {
        path: `${base.accountId}/delivery/${base.assetId}.m4a`,
        contentType: 'audio/mp4',
      },
    ]);
    expect(patches[0]).toEqual({ transcode_status: 'processing' });
    expect(patches.at(-1)).toMatchObject({
      transcode_status: 'ready',
      mime_type: 'audio/mp4',
      duration_ms: 12_000,
    });
  });

  it('marks the asset failed when ffmpeg fails', async () => {
    const { deps, patches } = makeDeps({
      transcode: vi.fn(async () => {
        throw new Error('Could not convert this audio.');
      }),
    });
    const result = await processIgAssetUpload(deps, {
      ...base,
      kind: 'audio',
      format: 'ogg',
    });

    expect(result).toEqual({
      status: 'failed',
      error: 'Could not convert this audio.',
    });
    expect(patches.at(-1)).toEqual({
      transcode_status: 'failed',
      transcode_error: 'Could not convert this audio.',
    });
  });

  it('rejects audio longer than 60 seconds', async () => {
    const { deps, patches, uploads } = makeDeps({
      transcode: vi.fn(async () => ({
        output: Buffer.from('x'),
        durationMs: 62_000,
      })),
    });
    const result = await processIgAssetUpload(deps, {
      ...base,
      kind: 'audio',
      format: 'mp4',
    });

    expect(result.status).toBe('failed');
    expect(uploads).toHaveLength(1);
    expect(patches.at(-1)).toMatchObject({ transcode_status: 'failed' });
  });

  it('passes non-audio files through without transcoding', async () => {
    const { deps } = makeDeps();
    const result = await processIgAssetUpload(deps, {
      ...base,
      kind: 'pdf',
      format: 'pdf',
    });

    expect(result).toMatchObject({ status: 'ready', durationMs: null });
    expect(deps.transcode).not.toHaveBeenCalled();
  });

  it('marks failed when storage upload fails', async () => {
    const { deps, patches } = makeDeps({
      upload: vi.fn(async () => {
        throw new Error('Storage upload failed');
      }),
    });
    const result = await processIgAssetUpload(deps, {
      ...base,
      kind: 'image',
      format: 'png',
    });

    expect(result.status).toBe('failed');
    expect(patches.at(-1)).toMatchObject({ transcode_status: 'failed' });
  });
});
