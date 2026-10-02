/**
 * Page PostgREST reads past `max_rows` (`apps/web/supabase/config.toml`, 1000).
 *
 * A bare `.select()` is silently truncated at that cap. `.range()` does not
 * raise it, so callers must request fixed windows and stop on a short page —
 * the same approach as Property Hive feed media
 * (`loadPublicFeedListingMedia`).
 */

/** Keep in step with `max_rows`. Larger windows are still truncated. */
export const CAMPAIGN_AUDIENCE_PAGE_SIZE = 1000;

/**
 * Values per `.in()` filter. PostgREST puts filters in the URL, and a 30k
 * email or id list exceeds typical gateway limits even when each response
 * would fit under `max_rows`.
 */
export const CAMPAIGN_AUDIENCE_IN_CHUNK = 100;

type PostgrestPageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchAllPagedRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<PostgrestPageResult<T>>,
  pageSize = CAMPAIGN_AUDIENCE_PAGE_SIZE,
): Promise<T[]> {
  if (pageSize < 1) {
    throw new Error('Page size must be positive');
  }

  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

export async function fetchAllRowsInChunks<T>(
  values: readonly string[],
  loadChunk: (chunk: readonly string[]) => Promise<T[]>,
  chunkSize = CAMPAIGN_AUDIENCE_IN_CHUNK,
): Promise<T[]> {
  if (values.length === 0) return [];
  if (chunkSize < 1) {
    throw new Error('Chunk size must be positive');
  }

  const rows: T[] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    rows.push(...(await loadChunk(values.slice(index, index + chunkSize))));
  }
  return rows;
}
