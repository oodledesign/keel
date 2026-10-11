import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';

import { loadBrochurePreviewData } from '../brochure-preview-data';

vi.mock('server-only', () => ({}));

const load = vi.fn<(listingId: string) => Promise<PublicBrochureData | null>>();
vi.mock('~/lib/commercial/brochure-pdf/load-listing-brochure-data', () => ({
  loadListingBrochureData: (listingId: string) => load(listingId),
}));

const listing = (id: string) =>
  ({ listing: { id } }) as unknown as PublicBrochureData;

describe('loadBrochurePreviewData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    load.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('reuses the data for a minute, then reloads', async () => {
    load.mockImplementation(async (id) => listing(id));
    await loadBrochurePreviewData('l1', 'a1');
    await loadBrochurePreviewData('l1', 'a1');
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);
    await loadBrochurePreviewData('l1', 'a1');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not keep a missing listing', async () => {
    load.mockResolvedValueOnce(null).mockResolvedValueOnce(listing('l2'));
    expect(await loadBrochurePreviewData('l2', 'a1')).toBeNull();
    expect(await loadBrochurePreviewData('l2', 'a1')).toEqual(listing('l2'));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
