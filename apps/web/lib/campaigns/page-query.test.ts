import { describe, expect, it, vi } from 'vitest';

import { CAMPAIGN_AUDIENCE_PAGE_SIZE, fetchAllPagedRows } from './page-query';

describe('fetchAllPagedRows', () => {
  it('requests the next page when the first page is full, then stops on a short page', async () => {
    const pageSize = CAMPAIGN_AUDIENCE_PAGE_SIZE;
    const loadPage = vi.fn(async (from: number) => {
      if (from === 0) {
        return {
          data: Array.from({ length: pageSize }, (_, index) => index),
          error: null,
        };
      }
      return { data: [pageSize], error: null };
    });

    await expect(fetchAllPagedRows(loadPage)).resolves.toHaveLength(
      pageSize + 1,
    );
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect(loadPage).toHaveBeenNthCalledWith(1, 0, pageSize - 1);
    expect(loadPage).toHaveBeenNthCalledWith(2, pageSize, pageSize * 2 - 1);
  });

  it('throws the page error instead of returning rows already loaded', async () => {
    const pageSize = CAMPAIGN_AUDIENCE_PAGE_SIZE;
    const loadPage = vi.fn(async (from: number) => {
      if (from === 0) {
        return {
          data: Array.from({ length: pageSize }, (_, index) => index),
          error: null,
        };
      }
      return { data: null, error: { message: 'statement timeout' } };
    });

    await expect(fetchAllPagedRows(loadPage)).rejects.toThrow(
      'statement timeout',
    );
    expect(loadPage).toHaveBeenCalledTimes(2);
  });
});
