import { describe, expect, it } from 'vitest';

import {
  createDefaultTimeline,
  removeRangeFromKeep,
  suggestZoomsFromClicks,
  sourceMsToEditedMs,
  editedDurationMs,
} from './edit-timeline';

describe('edit-timeline', () => {
  it('removes a middle selection from keep ranges', () => {
    const next = removeRangeFromKeep(
      [{ startMs: 0, endMs: 10_000 }],
      2_000,
      4_000,
    );
    expect(next).toEqual([
      { startMs: 0, endMs: 2_000 },
      { startMs: 4_000, endMs: 10_000 },
    ]);
    expect(editedDurationMs(next)).toBe(8_000);
  });

  it('maps source time into edited time across cuts', () => {
    const keep = [
      { startMs: 0, endMs: 1_000 },
      { startMs: 3_000, endMs: 4_000 },
    ];
    expect(sourceMsToEditedMs(keep, 500)).toBe(500);
    expect(sourceMsToEditedMs(keep, 2_000)).toBeNull();
    expect(sourceMsToEditedMs(keep, 3_500)).toBe(1_500);
  });

  it('suggests zooms from click clusters', () => {
    const timeline = createDefaultTimeline(20_000, [
      { tMs: 1_000, x: 0.2, y: 0.3 },
      { tMs: 1_200, x: 0.21, y: 0.31 },
      { tMs: 8_000, x: 0.8, y: 0.7 },
    ]);
    const zooms = suggestZoomsFromClicks(
      timeline.clicks,
      timeline.sourceDurationMs,
      timeline.keepRanges,
    );
    expect(zooms.length).toBeGreaterThanOrEqual(1);
    expect(zooms[0]!.scale).toBeGreaterThan(1);
  });
});
