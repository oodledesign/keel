import { describe, expect, it } from 'vitest';

import { UNDO_WINDOW_MS } from './constants';
import {
  isUndoWindowOpen,
  londonWeekStartYmd,
  previousLondonWeekStartYmd,
  undoWindowEndsAt,
} from './credit-rules';

describe('isUndoWindowOpen', () => {
  it('allows undo within 24 hours and blocks after', () => {
    const now = new Date('2026-09-12T12:00:00.000Z');
    expect(
      isUndoWindowOpen(new Date(now.getTime() - UNDO_WINDOW_MS + 1000), now),
    ).toBe(true);
    expect(
      isUndoWindowOpen(new Date(now.getTime() - UNDO_WINDOW_MS - 1000), now),
    ).toBe(false);
    expect(isUndoWindowOpen(null, now)).toBe(false);
  });

  it('returns the window end', () => {
    const burned = new Date('2026-09-12T10:00:00.000Z');
    expect(undoWindowEndsAt(burned)?.toISOString()).toBe(
      '2026-09-13T10:00:00.000Z',
    );
  });
});

describe('london week helpers', () => {
  it('returns the Monday of the London week', () => {
    // Saturday 12 Sep 2026 21:00 UTC is still Saturday in London (BST).
    expect(londonWeekStartYmd(new Date('2026-09-12T21:00:00.000Z'))).toBe(
      '2026-09-07',
    );
    expect(previousLondonWeekStartYmd(new Date('2026-09-12T21:00:00.000Z'))).toBe(
      '2026-08-31',
    );
  });
});
