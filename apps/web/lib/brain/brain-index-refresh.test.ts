import { describe, expect, it } from 'vitest';

import { brainChunksNeedRefresh } from './brain-index-refresh';

describe('brainChunksNeedRefresh', () => {
  const indexedRow = {
    indexed_at: '2026-06-03T10:00:00.000Z',
    embedding: [0.1],
  };

  it('returns true when no chunks exist yet', () => {
    expect(
      brainChunksNeedRefresh({
        sourceUpdatedAt: '2026-06-01T10:00:00.000Z',
        existingRows: [],
        chunkCount: 2,
      }),
    ).toBe(true);
  });

  it('returns false when indexed chunks are newer than the source update', () => {
    expect(
      brainChunksNeedRefresh({
        sourceUpdatedAt: '2026-06-01T10:00:00.000Z',
        existingRows: [indexedRow, indexedRow],
        chunkCount: 2,
      }),
    ).toBe(false);
  });

  it('returns true when the source was updated after indexing', () => {
    expect(
      brainChunksNeedRefresh({
        sourceUpdatedAt: '2026-06-04T10:00:00.000Z',
        existingRows: [indexedRow],
        chunkCount: 1,
      }),
    ).toBe(true);
  });

  it('returns true when chunk counts differ', () => {
    expect(
      brainChunksNeedRefresh({
        sourceUpdatedAt: '2026-06-01T10:00:00.000Z',
        existingRows: [indexedRow],
        chunkCount: 2,
      }),
    ).toBe(true);
  });
});
