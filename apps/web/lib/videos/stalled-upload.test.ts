import { describe, expect, it } from 'vitest';

import { STALLED_UPLOAD_AFTER_MS, isStalledUpload } from './stalled-upload';

const now = Date.parse('2026-10-05T12:00:00Z');
const old = new Date(now - STALLED_UPLOAD_AFTER_MS - 1000).toISOString();
const fresh = new Date(now - 1000).toISOString();

describe('isStalledUpload', () => {
  it('flags old uploading rows nobody is uploading', () => {
    expect(
      isStalledUpload(
        { id: 'a', status: 'uploading', created_at: old },
        now,
        new Set(),
      ),
    ).toBe(true);
  });

  it('ignores new rows, live uploads and other statuses', () => {
    expect(
      isStalledUpload(
        { id: 'a', status: 'uploading', created_at: fresh },
        now,
        new Set(),
      ),
    ).toBe(false);
    expect(
      isStalledUpload(
        { id: 'a', status: 'uploading', created_at: old },
        now,
        new Set(['a']),
      ),
    ).toBe(false);
    expect(
      isStalledUpload(
        { id: 'a', status: 'processing', created_at: old },
        now,
        new Set(),
      ),
    ).toBe(false);
  });
});
