export type BrainChunkIndexRow = {
  indexed_at: string | null;
  embedding: unknown;
};

/** True when stored chunks should be rewritten/re-embedded for this source. */
export function brainChunksNeedRefresh(params: {
  sourceUpdatedAt: string;
  existingRows: BrainChunkIndexRow[] | null | undefined;
  chunkCount: number;
}): boolean {
  const { sourceUpdatedAt, existingRows, chunkCount } = params;

  if (!existingRows?.length) {
    return true;
  }

  if (existingRows.length !== chunkCount) {
    return true;
  }

  const sourceUpdatedMs = new Date(sourceUpdatedAt).getTime();

  return existingRows.some((row) => {
    if (!row.embedding) {
      return true;
    }

    const indexedAt = row.indexed_at;
    if (!indexedAt) {
      return true;
    }

    return new Date(indexedAt).getTime() < sourceUpdatedMs;
  });
}
